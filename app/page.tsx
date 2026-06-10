'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hashPin, saveSession, getSession } from '@/lib/worldcup-auth'
import Image from 'next/image'

const PARTICIPANTS = [
  { username: '민제', displayName: '김민제', color: '#0057B8' },
  { username: '병운', displayName: '황병운', color: '#B8860B' },
  { username: '경민', displayName: '이경민', color: '#C0392B' },
]

export default function LoginPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (session) { router.replace('/dashboard'); return }
    setReady(true)
  }, [router])

  function selectUser(username: string) {
    setSelected(username)
    setPin('')
    setError('')
  }

  async function handleLogin() {
    if (!selected || pin.length !== 4 || loading) return
    setLoading(true)
    setError('')
    try {
      const pinHash = await hashPin(pin)
      const supabase = createClient()
      const { data, error: dbErr } = await supabase
        .from('worldcup_users')
        .select('id, username, display_name, color, is_admin')
        .eq('username', selected)
        .eq('pin_hash', pinHash)
        .single()

      if (dbErr) {
        if (dbErr.code === 'PGRST116') {
          setError('비밀번호가 틀렸어요.')
        } else {
          setError(`DB 오류: ${dbErr.message}`)
        }
        setPin('')
        setLoading(false)
        return
      }
      if (!data) {
        setError('비밀번호가 틀렸어요.')
        setPin('')
        setLoading(false)
        return
      }
      saveSession({ id: data.id, username: data.username, displayName: data.display_name, color: data.color, isAdmin: data.is_admin })
      router.replace('/dashboard')
    } catch {
      setError('오류가 발생했어요.')
      setLoading(false)
    }
  }

  if (!ready) return (
    <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: '#011638' }}>
      <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const selectedUser = PARTICIPANTS.find(p => p.username === selected)

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5" style={{ background: 'linear-gradient(160deg, #011638 0%, #02245A 60%, #011638 100%)' }}>
      {/* 로고 */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex items-center justify-center" style={{ width: 100, height: 100 }}>
          <Image src="/wc2026-logo.svg" alt="FIFA 월드컵 2026" width={100} height={100} style={{ objectFit: 'contain' }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white mt-4">2026 월드컵 토토</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>친구들과 함께하는 승부 예측</p>
      </div>

      <div className="w-full max-w-[360px] rounded-[20px] border p-6 flex flex-col gap-6"
        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
        {/* Step 1 */}
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>① 나를 선택하세요</p>
          <div className="grid grid-cols-3 gap-3">
            {PARTICIPANTS.map(p => {
              const isSelected = selected === p.username
              return (
                <button
                  key={p.username}
                  type="button"
                  onClick={() => selectUser(p.username)}
                  className="flex flex-col items-center gap-2.5 py-4 px-2 rounded-[14px] border-2 transition-all duration-150 select-none active:scale-95"
                  style={isSelected
                    ? { borderColor: '#FFB81C', background: 'rgba(255,184,28,0.12)' }
                    : { borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm"
                    style={{ backgroundColor: p.color }}>
                    {p.displayName[1]}
                  </div>
                  <span className="text-xs font-bold text-white">{p.displayName}</span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFB81C' }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#011638" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2 */}
        {selected && (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ② <span style={{ color: '#FFB81C' }} className="font-bold">{selectedUser?.displayName}</span>님의 비밀번호 4자리
            </p>
            <PinInput
              value={pin}
              color={selectedUser?.color ?? '#0057B8'}
              onChange={v => { setPin(v); setError('') }}
              onComplete={handleLogin}
            />
            {error && (
              <p className="text-xs font-medium mt-3 text-center" style={{ color: '#FF6B6B' }}>{error}</p>
            )}
          </div>
        )}

        {/* 입장 버튼 */}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || !selected || pin.length !== 4}
          className="w-full py-3.5 rounded-[12px] text-sm font-bold transition-all duration-150 active:scale-[0.98]"
          style={selected && pin.length === 4
            ? { background: 'linear-gradient(135deg, #FFB81C, #F59A00)', color: '#011638' }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(1,22,56,0.3)', borderTopColor: '#011638' }} />
              확인 중...
            </span>
          ) : '입장하기'}
        </button>
      </div>
    </div>
  )
}

function PinInput({ value, onChange, onComplete, color = '#0057B8' }: {
  value: string
  onChange: (v: string) => void
  onComplete?: () => void
  color?: string
}) {
  const digits = value.split('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
    onChange(v)
    if (v.length === 4) onComplete?.()
  }

  return (
    <div className="relative">
      <input
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        maxLength={4}
        autoFocus
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
        aria-label="4자리 비밀번호"
      />
      <div className="flex gap-3 justify-center pointer-events-none">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="w-14 h-14 rounded-[12px] border-2 flex items-center justify-center transition-all duration-150"
            style={
              i < digits.length
                ? { backgroundColor: color + '30', borderColor: '#FFB81C' }
                : i === digits.length
                ? { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 0 0 3px rgba(255,255,255,0.08)' }
                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.15)' }
            }
          >
            {digits[i] && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFB81C' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
