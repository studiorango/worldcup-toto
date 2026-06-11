'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { hashPin, saveSession, getSession } from '@/lib/worldcup-auth'
import Image from 'next/image'

const SERVERS = [
  { id: '퇴계원', label: '퇴계원', emoji: '🏘️' },
  { id: '지구',   label: '지구',   emoji: '🌍' },
]

interface DBUser {
  id: string
  username: string
  display_name: string
  color: string
  is_admin: boolean
  group: string
}

export default function LoginPage() {
  const router = useRouter()
  const [server, setServer] = useState<string | null>(null)
  const [users, setUsers] = useState<DBUser[]>([])
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

  async function selectServer(s: string) {
    setServer(s)
    setSelected(null)
    setPin('')
    setError('')
    const supabase = createClient()
    const { data } = await supabase
      .from('worldcup_users')
      .select('id, username, display_name, color, is_admin, group')
      .eq('group', s)
      .order('display_name')
    setUsers(data ?? [])
  }

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
        .select('id, username, display_name, color, is_admin, group')
        .eq('username', selected)
        .eq('pin_hash', pinHash)
        .single()

      if (dbErr || !data) {
        setError('비밀번호가 틀렸어요.')
        setPin('')
        setLoading(false)
        return
      }
      saveSession({
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        color: data.color,
        isAdmin: data.is_admin,
        group: data.group,
      })
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

  const selectedUser = users.find(u => u.username === selected)

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{ background: 'linear-gradient(160deg, #011638 0%, #02245A 60%, #011638 100%)' }}>

      {/* 로고 */}
      <div className="mb-8 text-center">
        <div className="mx-auto flex items-center justify-center mb-12" style={{ width: 100, height: 100 }}>
          <Image src="/wc2026-logo.svg" alt="FIFA 월드컵 2026" width={100} height={100} style={{ objectFit: 'contain' }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">2026 월드컵 토토</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>승무패, 스코어, 언오버 맞추기</p>
      </div>

      <div className="w-full max-w-[360px] rounded-[20px] border p-6 flex flex-col gap-6"
        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>

        {/* Step 1 — 서버 선택 */}
        <div>
          <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>① 서버를 선택하세요</p>
          <div className="grid grid-cols-2 gap-3">
            {SERVERS.map(s => {
              const isSelected = server === s.id
              return (
                <button key={s.id} type="button" onClick={() => selectServer(s.id)}
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-[14px] border-2 transition-all duration-150 select-none active:scale-95"
                  style={isSelected
                    ? { borderColor: '#FFB81C', background: 'rgba(255,184,28,0.12)' }
                    : { borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-3xl">{s.emoji}</span>
                  <span className="text-sm font-bold text-white">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2 — 유저 선택 */}
        {server && users.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>② 나를 선택하세요</p>
            <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto">
              {users.map(u => {
                const isSelected = selected === u.username
                return (
                  <button key={u.username} type="button" onClick={() => selectUser(u.username)}
                    className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-[12px] border-2 transition-all duration-150 select-none active:scale-95"
                    style={isSelected
                      ? { borderColor: '#FFB81C', background: 'rgba(255,184,28,0.12)' }
                      : { borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-base font-bold"
                      style={{ backgroundColor: u.color }}>
                      {u.display_name[1]}
                    </div>
                    <span className="text-[11px] font-bold text-white text-center leading-tight">{u.display_name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3 — PIN */}
        {selected && (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ③ <span style={{ color: '#FFB81C' }} className="font-bold">{selectedUser?.display_name}</span>님의 비밀번호 4자리
            </p>
            <PinInput value={pin} color={selectedUser?.color ?? '#0057B8'}
              onChange={v => { setPin(v); setError('') }} onComplete={handleLogin} />
            {error && (
              <p className="text-xs font-medium mt-3 text-center" style={{ color: '#FF6B6B' }}>{error}</p>
            )}
          </div>
        )}

        {/* 입장 버튼 */}
        <button type="button" onClick={handleLogin}
          disabled={loading || !selected || pin.length !== 4}
          className="w-full py-3.5 rounded-[12px] text-sm font-bold transition-all duration-150 active:scale-[0.98]"
          style={selected && pin.length === 4
            ? { background: 'linear-gradient(135deg, #FFB81C, #F59A00)', color: '#011638' }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(1,22,56,0.3)', borderTopColor: '#011638' }} />
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
      <input type="tel" inputMode="numeric" value={value} onChange={handleChange}
        maxLength={4} autoFocus
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
        aria-label="4자리 비밀번호" />
      <div className="flex gap-3 justify-center pointer-events-none">
        {[0, 1, 2, 3].map(i => (
          <div key={i}
            className="w-14 h-14 rounded-[12px] border-2 flex items-center justify-center transition-all duration-150"
            style={
              i < digits.length
                ? { backgroundColor: color + '30', borderColor: '#FFB81C' }
                : i === digits.length
                ? { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.6)', boxShadow: '0 0 0 3px rgba(255,255,255,0.08)' }
                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.15)' }
            }>
            {digits[i] && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFB81C' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
