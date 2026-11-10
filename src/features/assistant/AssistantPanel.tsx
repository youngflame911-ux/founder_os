import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, MicOff, RotateCcw, Sparkles, Square, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/primitives'
import { useUi } from '@/store/useUiStore'
import { getCapability, type Dictation, type SampleError, type SampleFn, type SampleMessage } from '@/lib/claudeRuntime'
import { cn } from '@/lib/utils'
import { buildContext, buildTools, RULES, undoActions, type AssistantAction } from './assistantCore'

interface Msg {
  id: string
  role: 'user' | 'assistant'
  text: string
  actions?: AssistantAction[]
  undone?: boolean
  error?: string
  pending?: boolean
}

const HISTORY_KEY = 'founder-os:assistant'
const EXAMPLES = [
  'Добавь задачу: подготовить КП для инвестора до пятницы, важно, 3 часа',
  'Сегодня закрыл договор с поставщиком панелей',
  'Получили первую оплату 150 000 ₽',
  'Встреча с банком в четверг в 15:00 на час',
  'Что у меня горит на этой неделе?',
]

const ERROR_TEXT: Record<string, string> = {
  not_granted: 'Доступ к Claude для этой страницы не разрешён. Разрешите его в меню страницы.',
  sampling_disabled: 'Claude недоступен для этого аккаунта.',
  rate_limited: 'Слишком много запросов или исчерпан лимит. Попробуйте чуть позже.',
  session_expired: 'Сессия истекла — войдите в Claude заново.',
  refused: 'Claude отказался выполнять этот запрос. Переформулируйте.',
  prompt_too_large: 'Слишком много данных для одного запроса.',
  empty_completion: 'Ответ пустой. Попробуйте сформулировать проще.',
}

const loadHistory = (): Msg[] => {
  try {
    return (JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as Msg[]).filter((m) => !m.pending).slice(-30)
  } catch {
    return []
  }
}

/** Доступность ассистента: только внутри Claude и если среда разрешает инструменты */
export function useAssistantAvailable() {
  const [state, setState] = useState<{ sample: SampleFn | null; tools: boolean; ready: boolean }>({ sample: null, tools: false, ready: false })
  useEffect(() => {
    let alive = true
    getCapability('sample').then(async (s) => {
      const limits = s ? await s.limits().catch(() => null) : null
      if (alive) setState({ sample: s, tools: !!limits?.tools, ready: true })
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}

export function AssistantPanel() {
  const { assistant, setAssistant } = useUi()
  const { sample, tools } = useAssistantAvailable()
  const [msgs, setMsgs] = useState<Msg[]>(loadHistory)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const ctl = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Открыли с готовым текстом (из командной строки на главной) — отправляем сразу
  useEffect(() => {
    if (assistant.open && assistant.draft) {
      void send(assistant.draft)
      setAssistant(true, '')
    } else if (assistant.open) inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant.open])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.filter((m) => !m.pending).slice(-30)))
    } catch {
      /* история — удобство, не обязательна */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [msgs, progress])

  useEffect(() => {
    if (!assistant.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setAssistant(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assistant.open, busy, setAssistant])

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy || !sample) return
    setInput('')
    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', text }
    const replyId = crypto.randomUUID()
    const history = msgs.filter((m) => !m.error && !m.pending).slice(-8)
    setMsgs((m) => [...m, userMsg, { id: replyId, role: 'assistant', text: '', pending: true }])
    setBusy(true)
    setProgress([])
    const actions: AssistantAction[] = []
    const log = (a: AssistantAction) => {
      actions.push(a)
      setProgress((p) => [...p, a.label])
    }
    const turns: SampleMessage[] = [
      { role: 'user', content: `${RULES}\n\nДАННЫЕ СИСТЕМЫ НА ЭТОТ МОМЕНТ:\n${buildContext()}` },
      ...history.map((m) => ({ role: m.role, content: m.text + (m.actions?.length ? `\n[выполнено: ${m.actions.map((a) => a.label).join('; ')}${m.undone ? ' — отменено пользователем' : ''}]` : '') })),
      { role: 'user', content: text },
    ]
    ctl.current = new AbortController()
    try {
      const { text: answer } = await sample(turns, {
        tools: tools ? buildTools(log) : undefined,
        modelTier: 'default',
        effort: 'low',
        signal: ctl.current.signal,
        onText: ({ text: t }) => setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: t } : x))),
      })
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: answer.trim(), pending: false, actions } : x)))
    } catch (err) {
      const e = err as SampleError
      const message = e.code === 'cancelled' ? 'Остановлено.' : (ERROR_TEXT[e.code] ?? 'Не удалось получить ответ. Попробуйте ещё раз.')
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: e.code === 'refused' ? '' : (e.text ?? x.text), pending: false, actions, error: message } : x)))
    } finally {
      setBusy(false)
      setProgress([])
      ctl.current = null
    }
  }

  const undo = (id: string) => {
    const m = msgs.find((x) => x.id === id)
    if (!m?.actions?.length || m.undone) return
    undoActions(m.actions)
    setMsgs((all) => all.map((x) => (x.id === id ? { ...x, undone: true } : x)))
  }

  if (!assistant.open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Ассистент">
      <button className="absolute inset-0 bg-black/30" aria-label="Закрыть ассистента" onClick={() => !busy && setAssistant(false)} />
      <aside className="relative flex h-full w-full max-w-[440px] flex-col border-l bg-background shadow-2xl max-sm:mt-auto max-sm:h-[88dvh] max-sm:rounded-t-xl max-sm:border-l-0 max-sm:border-t">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold leading-none">Ассистент</h2>
            <p className="mt-1 text-xs text-muted-foreground">Пишите как в мессенджере — система обновится сама</p>
          </div>
          <div className="flex items-center gap-1">
            {msgs.length > 0 && !busy && (
              <Button variant="ghost" size="icon-sm" onClick={() => setMsgs([])} aria-label="Очистить историю" title="Очистить историю">
                <Trash2 />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => setAssistant(false)} disabled={busy} aria-label="Закрыть">
              <X />
            </Button>
          </div>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {!sample ? (
            <p className="text-sm text-muted-foreground">Ассистент работает, когда Founder OS открыт по ссылке внутри Claude. В скачанном файле его нет.</p>
          ) : msgs.length === 0 ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Например:</p>
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => send(ex)} className="rounded-md border px-3 py-2 text-left text-sm leading-snug transition-colors hover:bg-accent">
                  {ex}
                </button>
              ))}
              {!tools && <p className="text-xs text-warning">В этом окне Claude может только отвечать, но не менять данные. Откройте страницу в браузере или в приложении Claude последней версии.</p>}
            </div>
          ) : (
            <div className="grid gap-4">
              {msgs.map((m) =>
                m.role === 'user' ? (
                  <p key={m.id} className="ml-8 justify-self-end whitespace-pre-wrap rounded-md bg-foreground px-3 py-2 text-sm text-background">
                    {m.text}
                  </p>
                ) : (
                  <div key={m.id} className="grid gap-2">
                    {m.pending && !m.text && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" /> Думаю…
                      </p>
                    )}
                    {(m.pending ? progress : (m.actions ?? []).map((a) => a.label)).length > 0 && (
                      <ul className={cn('grid gap-1 border-l-2 border-primary/60 pl-3 text-[13px]', m.undone && 'opacity-50 line-through')}>
                        {(m.pending ? progress : m.actions!.map((a) => a.label)).map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    )}
                    {m.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>}
                    {m.error && <p className="text-sm text-destructive">{m.error}</p>}
                    {!m.pending && !!m.actions?.length && (
                      <div>
                        {m.undone ? (
                          <span className="text-xs text-muted-foreground">Изменения отменены</span>
                        ) : (
                          <button onClick={() => undo(m.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                            <RotateCcw className="h-3 w-3" /> Отменить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {sample && <Composer inputRef={inputRef} value={input} onChange={setInput} onSend={() => send(input)} busy={busy} onStop={() => ctl.current?.abort()} />}
      </aside>
    </div>
  )
}

function Composer({ value, onChange, onSend, busy, onStop, inputRef }: { value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; onStop: () => void; inputRef: React.RefObject<HTMLTextAreaElement> }) {
  const [dict, setDict] = useState<Dictation | null>(null)
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState('')
  const base = useRef('')
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    let offs: (() => void)[] = []
    getCapability('dictation').then((d) => {
      if (!d) return
      setDict(d)
      offs = [
        d.onPartial(({ text }) => setPartial(text)),
        d.onFinal(({ text }) => {
          base.current = (base.current ? base.current + ' ' : '') + text.trim()
          onChange(base.current)
          setPartial('')
        }),
        d.onState(({ state }) => setListening(state === 'listening' || state === 'starting')),
      ]
    })
    return () => offs.forEach((o) => o())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleMic = () => {
    if (!dict) return
    if (listening) {
      void dict.stop()
      return
    }
    base.current = valueRef.current.trim()
    dict.start({ language: 'ru' }).catch(() => setListening(false))
  }

  const shown = partial ? `${value}${value ? ' ' : ''}${partial}` : value

  return (
    <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2 rounded-md border bg-card p-2 focus-within:border-ring">
        <textarea
          ref={inputRef}
          id="assistant-input"
          rows={2}
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={listening ? 'Говорите…' : 'Что сделать? Enter — отправить'}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        {dict && (
          <Button type="button" variant={listening ? 'destructive' : 'ghost'} size="icon" onClick={toggleMic} aria-label={listening ? 'Остановить диктовку' : 'Надиктовать'} title={listening ? 'Остановить' : 'Надиктовать голосом'}>
            {listening ? <MicOff /> : <Mic />}
          </Button>
        )}
        {busy ? (
          <Button type="button" size="icon" variant="secondary" onClick={onStop} aria-label="Остановить">
            <Square />
          </Button>
        ) : (
          <Button type="button" size="icon" onClick={onSend} disabled={!value.trim()} aria-label="Отправить">
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  )
}
