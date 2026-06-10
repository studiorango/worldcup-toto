'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hashPin, saveSession, getSession } from '@/lib/worldcup-auth'

const PARTICIPANTS = [
  { username: '민제', displayName: '김민제', color: '#7C8C03' },
  { username: '병운', displayName: '황병운', color: '#49627A' },
  { username: '경민', displayName: '이경민', color: '#F94239' },
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
    <div className="min-h-[100dvh] bg-[#F5F7FA] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7C8C03] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const selectedUser = PARTICIPANTS.find(p => p.username === selected)

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col items-center justify-center px-5">
      <div className="mb-8 text-center">
        <div
          className="w-20 h-20 rounded-[24px] flex items-center justify-center mx-auto mb-4 shadow-[0_8px_24px_rgba(124,140,3,0.25)]"
          style={{ background: 'linear-gradient(135deg, #7C8C03, #A0B020, #CEDA80)' }}
        >
          <span className="text-4xl">⚽</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#222222] tracking-tight">2026 월드컵 토토</h1>
        <p className="text-sm text-[#8B8B8B] mt-1">친구들과 함께하는 승부 예측</p>
      </div>

      <div className="w-full max-w-[360px] bg-white rounded-[20px] border border-[#E6E6E6] shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold text-[#8B8B8B] mb-3">① 나를 선택하세요</p>
          <div className="grid grid-cols-3 gap-3">
            {PARTICIPANTS.map(p => {
              const isSelected = selected === p.username
              return (
                <button
                  key={p.username}
                  type="button"
                  onClick={() => selectUser(p.username)}
                  style={isSelected ? { borderColor: p.color, backgroundColor: p.color + '12' } : {}}
                  className={`flex flex-col items-center gap-2.5 py-4 px-2 rounded-[14px] border-2 transition-all duration-150 select-none
                    ${isSelected ? 'border-2 shadow-md' : 'border-[#E6E6E6] bg-[#FAFAFA] hover:bg-[#F5F5F5] active:scale-95'}`}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.displayName[1]}
                  </div>
                  <span className="text-xs font-bold text-[#222222]">{p.displayName}</span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: p.color }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {selected && (
          <div>
            <p className="text-xs font-semibold text-[#8B8B8B] mb-3">
              ② <span style={{ color: selectedUser?.color }} className="font-bold">{selectedUser?.displayName}</span>님의 비밀번호 4자리
            </p>
            <PinInput
              value={pin}
              color={selectedUser?.color ?? '#7C8C03'}
              onChange={v => { setPin(v); setError('') }}
              onComplete={handleLogin}
            />
            {error && (
              <p className="text-xs text-[#F94239] font-medium mt-3 text-center">{error}</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || !selected || pin.length !== 4}
          className="w-full py-3.5 rounded-[12px] text-sm font-bold transition-all duration-150 active:scale-[0.98] disabled:bg-[#F5F5F5] disabled:text-[#BBBBBB]"
          style={selected && pin.length === 4 ? { backgroundColor: selectedUser?.color, color: '#fff' } : {}}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              확인 중...
            </span>
          ) : '입장하기'}
        </button>
      </div>
    </div>
  )
}

function PinInput({ value, onChange, onComplete, color = '#7C8C03' }: {
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
                ? { backgroundColor: color + '18', borderColor: color }
                : i === digits.length
                ? { backgroundColor: '#fff', borderColor: '#222222', boxShadow: '0 0 0 3px rgba(0,0,0,0.06)' }
                : { backgroundColor: '#F5F5F5', borderColor: '#E6E6E6' }
            }
          >
            {digits[i] && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
