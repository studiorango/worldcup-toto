'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { getSession, clearSession, type WCUser } from '@/lib/worldcup-auth'
import { ALL_MATCHES, type Match, type MatchStage } from '@/lib/matches'

type BetType = 'result' | 'score' | 'overunder'

interface DBUser   { id: string; username: string; display_name: string; color: string; is_admin: boolean; group: string }
interface DBBet    { id: string; user_id: string; match_id: string; bet_type: BetType; bet_value: string; is_correct: boolean | null }
interface DBResult {
  match_id: string
  result: string
  home_score: number
  away_score: number
  score: string
  over_under: string
}

const SHORT_NAMES: Record<string, string> = {
  '남아프리카공화국': '남아공',
  '보스니아헤르체고비나': '보스니아',
  '사우디아라비아': '사우디',
  '콩고민주공화국': '콩고DR',
  '코트디부아르': '코트디',
  '우즈베키스탄': '우즈벡',
}
function shortName(name: string) { return SHORT_NAMES[name] ?? name }


const SQUADS: Record<string, string[]> = {
  '대한민국':['손흥민','이강인','황희찬','김민재','조현우','정우영','황인범','오세훈'],
  '멕시코':['로사노','히메네스','사포데','오초아','알바레스'],
  '체코':['실하비','흘로제크','쿠치타','콜라르'],
  '브라질':['비니시우스','호드리구','라피냐','에데르 밀리탕','알리송'],
  '독일':['무시알라','하버츠','뮐러','노이어','키미히','귄도안'],
  '아르헨티나':['메시','알바레스','디 마리아','디부 마르티네스','데 폴'],
  '프랑스':['음바페','지루','뎀벨레','로리스','그리즈만'],
  '스페인':['야말','모라타','페드리','로드리','윌리엄스'],
  '잉글랜드':['케인','벨링엄','래쉬퍼드','트렌트','픽퍼드'],
  '포르투갈':['호날두','펠릭스','베르나르두 실바','루벤 디아스'],
  '네덜란드':['판다이크','흐라베르베르흐','뒤프레','베르바위트'],
  '일본':['미나미노','미토마','토미야스','엔도'],
  '우루과이':['수아레스','발베르데','아라우호'],
}



function isLocked(match: Match): boolean {
  const matchTime = new Date(`${match.dateKST}T${match.timeKST}:00+09:00`)
  return Date.now() >= matchTime.getTime() - 5 * 60 * 1000
}

function isCorrect(bet: DBBet, result: DBResult): boolean {
  if (bet.bet_type === 'result') return bet.bet_value === result.result
  if (bet.bet_type === 'score') return bet.bet_value === result.score
  if (bet.bet_type === 'overunder') return bet.bet_value === result.over_under
  return false
}

function calcScores(users: DBUser[], bets: DBBet[], results: DBResult[]): { user: DBUser; score: number }[] {
  return users.map(u => {
    const myBets = bets.filter(b => b.user_id === u.id)
    let score = 0
    myBets.forEach(b => {
      const r = results.find(r => r.match_id === b.match_id)
      if (r && isCorrect(b, r)) score++
    })
    return { user: u, score }
  }).sort((a, b) => b.score - a.score)
}

const STAGE_LABELS: Record<MatchStage,string> = {
  group:'조별리그', r32:'32강', r16:'16강', qf:'8강', sf:'4강', '3rd':'3·4위전', final:'결승',
}
const BET_LABELS: Record<BetType,string> = {
  result:'승무패', score:'스코어', overunder:'언더/오버',
}
const RESULT_OPTIONS = ['홈 승','무승부','원정 승']
const OU_OPTIONS = ['언더 2.5','오버 2.5']

function AdminPanel({ results, onSaved }: { results: DBResult[]; onSaved: () => void }) {
  const supabase = createClient()
  const now = Date.now()

  // 경기 시작 후 90분 이상 지난 경기 (결과 입력 가능)
  const finishedMatches = ALL_MATCHES.filter(m => {
    const t = new Date(`${m.dateKST}T${m.timeKST}:00+09:00`).getTime()
    return now >= t + 90 * 60 * 1000
  })

  const [selectedId, setSelectedId] = useState(finishedMatches[0]?.id ?? '')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const selectedMatch = ALL_MATCHES.find(m => m.id === selectedId)
  const existingResult = results.find(r => r.match_id === selectedId)

  useEffect(() => {
    if (existingResult) {
      setHomeScore(String(existingResult.home_score))
      setAwayScore(String(existingResult.away_score))
    } else {
      setHomeScore('')
      setAwayScore('')
    }
  }, [selectedId, existingResult])

  async function handleSave() {
    if (!selectedMatch || homeScore === '' || awayScore === '') return
    setSaving(true)
    const hs = parseInt(homeScore)
    const as_ = parseInt(awayScore)
    const result = hs > as_ ? '홈 승' : as_ > hs ? '원정 승' : '무승부'
    const score = `${hs}:${as_}`
    const over_under = hs + as_ > 2 ? '오버' : '언더'

    const { error } = await supabase.from('worldcup_match_results').upsert({
      match_id: selectedId, home_score: hs, away_score: as_,
      result, score, over_under,
    }, { onConflict: 'match_id' })

    if (!error) {
      setMsg('저장 완료!')
      onSaved()
    } else {
      setMsg('저장 실패: ' + error.message)
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  if (finishedMatches.length === 0) return null

  return (
    <div className="bg-white rounded-[14px] border-2 border-[#CEDA80] p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon icon="solar:settings-bold" className="w-4 h-4 text-[#7C8C03]" />
        <span className="text-sm font-extrabold text-[#222222]">결과 수동 입력</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6EBB8] text-[#7C8C03]">관리자</span>
      </div>

      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full bg-[#F5F5F5] border border-[#E6E6E6] rounded-[10px] px-3 py-2.5 text-sm text-[#222222] mb-3 focus:outline-none focus:border-[#222222]">
        {finishedMatches.map(m => {
          const hasResult = results.some(r => r.match_id === m.id)
          return (
            <option key={m.id} value={m.id}>
              {hasResult ? '✓ ' : ''}{m.dateKST.slice(5)} {m.timeKST} {shortName(m.home)} vs {shortName(m.away)}
            </option>
          )
        })}
      </select>

      {selectedMatch && (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 text-center">
            <p className="text-xs text-[#8B8B8B] mb-1">{selectedMatch.homeFlag} {shortName(selectedMatch.home)}</p>
            <input
              type="number" min="0" max="20" value={homeScore}
              onChange={e => setHomeScore(e.target.value)}
              placeholder="0"
              className="w-full text-center text-2xl font-extrabold bg-[#F5F5F5] border border-[#E6E6E6] rounded-[10px] py-2 focus:outline-none focus:border-[#222222] text-[#222222]" />
          </div>
          <span className="text-lg font-bold text-[#BBBBBB] mt-4">:</span>
          <div className="flex-1 text-center">
            <p className="text-xs text-[#8B8B8B] mb-1">{selectedMatch.awayFlag} {shortName(selectedMatch.away)}</p>
            <input
              type="number" min="0" max="20" value={awayScore}
              onChange={e => setAwayScore(e.target.value)}
              placeholder="0"
              className="w-full text-center text-2xl font-extrabold bg-[#F5F5F5] border border-[#E6E6E6] rounded-[10px] py-2 focus:outline-none focus:border-[#222222] text-[#222222]" />
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || homeScore === '' || awayScore === ''}
        className="w-full bg-[#7C8C03] text-white py-2.5 rounded-[10px] text-sm font-semibold disabled:opacity-40 transition-colors hover:bg-[#5A6602]">
        {saving ? '저장 중...' : existingResult ? '결과 수정' : '결과 저장'}
      </button>
      {msg && <p className="text-xs text-center mt-2 text-[#7C8C03] font-semibold">{msg}</p>}
    </div>
  )
}

function Avatar({ user }: { user: DBUser }) {
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 ring-2 ring-white"
      style={{ backgroundColor: user.color }} title={user.display_name}>
      {user.display_name[0]}
    </div>
  )
}

function BetBadge({ type, value }: { type: BetType; value: string }) {
  const s: Record<BetType, string> = {
    result:    'bg-[#EBF3FF] text-[#0057B8] border border-[#FFB81C]',
    score:     'bg-[#F5F7FA] text-[#49627A] border border-[#E6E6E6]',
    overunder: 'bg-[#FFF4D8] text-[#FFB803] border border-[#FFB803]/30',
  }
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s[type]}`}>{value}</span>
}

function Leaderboard({ users, bets, results }: { users: DBUser[]; bets: DBBet[]; results: DBResult[] }) {
  const scores = calcScores(users, bets, results)
  const medals = ['🥇', '🥈', '🥉']
  const rankColors = [
    { border: 'rgba(255,184,28,0.6)', bg: 'rgba(255,184,28,0.12)' },
    { border: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.08)' },
    { border: 'rgba(255,255,255,0.15)', bg: 'rgba(255,255,255,0.05)' },
  ]

  return (
    <div className="bg-white rounded-[20px] border border-[#E6E6E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-[#E6E6E6]">
        <span className="text-sm font-extrabold text-[#222222]">순위표</span>
      </div>
      <div className="flex flex-col divide-y divide-[#E6E6E6]">
        {scores.map(({ user, score }, i) => (
          <div key={user.id}
            className="flex items-center gap-4 px-5 py-3.5"
            style={i === 0 ? { background: 'rgba(255,184,28,0.06)' } : {}}>
            <span className="text-xl w-6 text-center flex-shrink-0">{i < 3 ? medals[i] : <span className="text-sm font-bold text-[#8B8B8B]">{i + 1}</span>}</span>
            <span className="flex-1 text-sm font-semibold text-[#222222]">{user.display_name}</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-extrabold" style={{ color: i === 0 ? '#FFB81C' : '#011638' }}>{score}</span>
              <span className="text-xs text-[#8B8B8B]">점</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BetPanel({ match, bets, users, myId, results, onBet }: {
  match: Match; bets: DBBet[]; users: DBUser[]; myId: string
  results: DBResult[]
  onBet: (matchId: string, t: BetType, v: string) => Promise<void>
}) {
  const [tab, setTab] = useState<BetType>('result')
  const [scoreHome, setScoreHome] = useState('')
  const [scoreAway, setScoreAway] = useState('')
  const [saving, setSaving] = useState(false)

  const locked = isLocked(match)
  const matchResult = results.find(r => r.match_id === match.id)
  const matchBets = bets.filter(b => b.match_id === match.id && b.bet_type === tab)
  const myBet = matchBets.find(b => b.user_id === myId)
  const isKnockout = match.stage !== 'group'

  async function save(type: BetType, value: string) {
    if (locked) return
    setSaving(true)
    await onBet(match.id, type, value)
    setSaving(false)
  }

  return (
    <div className="border-t border-[#E6E6E6]">
      {locked && (
        <div className="bg-[#F5F5F5] px-4 py-2 flex items-center gap-1.5">
          <Icon icon="solar:lock-bold" className="w-3.5 h-3.5 text-[#8B8B8B]" />
          <span className="text-xs font-semibold text-[#8B8B8B]">베팅 마감 — 경기 시작 5분 전에 마감됩니다</span>
        </div>
      )}
      <div className="flex border-b border-[#E6E6E6] px-4 gap-1 overflow-x-auto no-scrollbar">
        {(['result', 'score', 'overunder'] as BetType[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-shrink-0 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === t ? 'border-[#0057B8] text-[#0057B8]' : 'border-transparent text-[#8B8B8B]'
            }`}>
            {BET_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3 pb-4">
        {matchBets.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {matchBets.map(b => {
              const u = users.find(x => x.id === b.user_id)
              if (!u) return null
              const correct = matchResult ? isCorrect(b, matchResult) : null
              return (
                <div key={b.user_id}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                    correct === true ? 'bg-[#EBF3FF]' : correct === false ? 'bg-[#FFF5F5]' : 'bg-[#F5F7FA]'
                  }`}>
                  <span className="text-[11px] font-semibold text-[#222222]">{u.display_name}</span>
                  <BetBadge type={b.bet_type} value={b.bet_value} />
                  {correct === true && <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5 text-[#0057B8]" />}
                  {correct === false && <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5 text-[#F94239]" />}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'result' && (
          <div className={`grid gap-2 ${isKnockout ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {(isKnockout ? [
              { value: '홈 승', label: `${shortName(match.home)} 승` },
              { value: '원정 승', label: `${shortName(match.away)} 승` },
            ] : [
              { value: '홈 승', label: `${shortName(match.home)} 승` },
              { value: '무승부', label: '무승부' },
              { value: '원정 승', label: `${shortName(match.away)} 승` },
            ]).map(({ value, label }) => (
              <button key={value} disabled={saving || locked} onClick={() => save('result', value)}
                className={`py-3 rounded-[12px] text-sm font-semibold transition-all active:scale-[0.97] ${
                  locked
                    ? myBet?.bet_value === value ? 'bg-[#EBF3FF] text-[#0057B8] border border-[#FFB81C]' : 'bg-[#FAFAFA] text-[#BBBBBB] cursor-not-allowed'
                    : myBet?.bet_value === value ? 'bg-[#0057B8] text-white shadow-[0_2px_8px_rgba(124,140,3,0.3)]' : 'bg-[#F5F5F5] text-[#222222] hover:bg-[#E6E6E6]'
                }`}>{label}
              </button>
            ))}
          </div>
        )}

        {tab === 'score' && (
          <div>
            <div className="flex items-center gap-3 justify-center mb-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">{match.homeFlag}</span>
                <input type="number" min={0} max={20} value={scoreHome}
                  onChange={e => setScoreHome(e.target.value)} placeholder="0"
                  disabled={locked}
                  className="w-16 h-14 text-center text-2xl font-extrabold bg-[#F5F5F5] border border-[#E6E6E6] rounded-[12px] focus:outline-none focus:border-[#222222] focus:bg-white transition-colors disabled:opacity-50" />
              </div>
              <span className="text-2xl font-extrabold text-[#BBBBBB] mt-5">:</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">{match.awayFlag}</span>
                <input type="number" min={0} max={20} value={scoreAway}
                  onChange={e => setScoreAway(e.target.value)} placeholder="0"
                  disabled={locked}
                  className="w-16 h-14 text-center text-2xl font-extrabold bg-[#F5F5F5] border border-[#E6E6E6] rounded-[12px] focus:outline-none focus:border-[#222222] focus:bg-white transition-colors disabled:opacity-50" />
              </div>
            </div>
            {!locked && (
              <button onClick={() => { if (scoreHome !== '' && scoreAway !== '') save('score', `${scoreHome}:${scoreAway}`) }}
                disabled={saving || scoreHome === '' || scoreAway === ''}
                className="w-full bg-[#0057B8] text-white py-2.5 rounded-[12px] text-sm font-semibold hover:bg-[#003D8A] active:scale-[0.98] disabled:bg-[#FAFAFA] disabled:text-[#BBBBBB] transition-all">
                저장
              </button>
            )}
          </div>
        )}

        {tab === 'overunder' && (
          <div className="grid grid-cols-2 gap-2">
            {OU_OPTIONS.map(opt => (
              <button key={opt} disabled={saving || locked} onClick={() => save('overunder', opt)}
                className={`py-3 rounded-[12px] text-sm font-semibold transition-all active:scale-[0.97] ${
                  locked
                    ? myBet?.bet_value === opt ? 'bg-[#EBF3FF] text-[#0057B8] border border-[#FFB81C]' : 'bg-[#FAFAFA] text-[#BBBBBB] cursor-not-allowed'
                    : myBet?.bet_value === opt ? 'bg-[#0057B8] text-white shadow-[0_2px_8px_rgba(124,140,3,0.3)]' : 'bg-[#F5F5F5] text-[#222222] hover:bg-[#E6E6E6]'
                }`}>{opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MatchCard({ match, bets, users, myId, results, onBet }: {
  match: Match; bets: DBBet[]; users: DBUser[]; myId: string
  results: DBResult[]
  onBet: (matchId: string, t: BetType, v: string) => Promise<void>
}) {
  const locked = isLocked(match)
  return (
    <div className="bg-white rounded-[14px] border border-[#FFB81C] shadow-[0_2px_8px_rgba(124,140,3,0.08)] overflow-hidden">
      <div className="p-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold text-[#49627A] bg-[#F5F7FA] px-2 py-0.5 rounded-full">{match.group}</span>
          <div className="flex items-center gap-1.5">
            {locked
              ? <span className="text-[11px] font-bold text-[#8B8B8B] flex items-center gap-1"><Icon icon="solar:lock-bold" className="w-3 h-3"/>마감</span>
              : <span className="text-[11px] text-[#8B8B8B] font-medium">{match.dateKST.slice(5).replace('-','/')} {match.timeKST} KST</span>
            }
          </div>
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col items-center gap-2 flex-1">
            <span className="text-5xl leading-none">{match.homeFlag}</span>
            <span className="text-base font-extrabold text-[#222222] text-center break-keep">{match.home}</span>
          </div>
          <span className="text-sm font-bold text-[#BBBBBB] px-2">VS</span>
          <div className="flex flex-col items-center gap-2 flex-1">
            <span className="text-5xl leading-none">{match.awayFlag}</span>
            <span className="text-base font-extrabold text-[#222222] text-center break-keep">{match.away}</span>
          </div>
        </div>
      </div>
      <BetPanel match={match} bets={bets} users={users} myId={myId} results={results} onBet={onBet} />
    </div>
  )
}

const BET_TYPE_LABEL: Record<BetType, string> = { result: '승무패', score: '스코어', overunder: '언/오버' }

function MyBets({ bets, results, myId }: {
  bets: DBBet[]
  results: DBResult[]
  myId: string
}) {
  const myBets = bets.filter(b => b.user_id === myId)
  if (myBets.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border border-[#E6E6E6] p-10 text-center text-[#BBBBBB] text-sm mb-6">
        아직 베팅한 경기가 없어요
      </div>
    )
  }

  const BET_ORDER: BetType[] = ['result', 'score', 'overunder']

  const byMatch = ALL_MATCHES.map(match => {
    const matchBets = myBets.filter(b => b.match_id === match.id)
      .sort((a, b) => BET_ORDER.indexOf(a.bet_type) - BET_ORDER.indexOf(b.bet_type))
    if (matchBets.length === 0) return null
    const result = results.find(r => r.match_id === match.id)
    return { match, bets: matchBets, result }
  }).filter(Boolean) as { match: Match; bets: DBBet[]; result: DBResult | undefined }[]

  function displayBetValue(bet: DBBet, match: Match) {
    if (bet.bet_type !== 'result') return bet.bet_value
    if (bet.bet_value === '홈 승') return `${shortName(match.home)} 승`
    if (bet.bet_value === '원정 승') return `${shortName(match.away)} 승`
    return bet.bet_value
  }

  return (
    <section className="mb-6">
      <div className="flex flex-col gap-3">
        {byMatch.map(({ match, bets: mb, result }) => (
          <div key={match.id} className="bg-white rounded-[14px] border border-[#E6E6E6] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E6E6E6] flex items-center bg-[#F5F7FA]">
              <span className="w-24 text-xs font-semibold text-[#8B8B8B] flex-shrink-0">{match.dateKST.slice(5).replace('-','/')} {match.timeKST}</span>
              <p className="flex-1 text-sm font-bold text-[#222222] text-center">{shortName(match.home)} vs {shortName(match.away)}</p>
              <div className="w-24 flex justify-end flex-shrink-0">
                {result ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E6EBB8] text-[#7C8C03]">결과 발표</span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#49627A]">대기중</span>
                )}
              </div>
            </div>
            <div className="divide-y divide-[#E6E6E6]">
              {mb.map(bet => {
                const correct = result ? isCorrect(bet, result) : null
                return (
                  <div key={bet.id} className="grid grid-cols-3 items-center px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#49627A] w-fit">
                      {BET_TYPE_LABEL[bet.bet_type]}
                    </span>
                    <span className="text-sm font-semibold text-[#222222] text-center">{displayBetValue(bet, match)}</span>
                    <div className="text-right">
                      {correct === null ? (
                        <span className="text-xs text-[#BBBBBB]">—</span>
                      ) : correct ? (
                        <span className="text-sm font-bold text-[#01A484]">✓ 정답</span>
                      ) : (
                        <span className="text-sm font-bold text-[#F94239]">✗ 오답</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ScheduleRow({ match, expanded, onToggle }: {
  match: Match
  expanded: boolean; onToggle: () => void
}) {
  return (
    <div className={expanded ? 'bg-[#F5F7FA]' : ''}>
      <button onClick={onToggle} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[#F5F7FA] transition-colors">
        <div className="text-center w-12 flex-shrink-0">
          <p className="text-xs font-bold text-[#222222]">{match.timeKST}</p>
          <p className="text-[10px] text-[#8B8B8B]">KST</p>
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{match.homeFlag}</span>
          <span className="text-xs font-semibold text-[#222222] break-keep truncate">{match.home}</span>
          <span className="text-[10px] text-[#BBBBBB] flex-shrink-0">vs</span>
          <span className="text-xs font-semibold text-[#222222] break-keep truncate">{match.away}</span>
          <span className="text-xl flex-shrink-0">{match.awayFlag}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {match.stage === 'group' && (
            <span className="text-[10px] font-semibold text-[#49627A] bg-[#F5F7FA] px-1.5 py-0.5 rounded-full">{match.group}</span>
          )}
          <Icon icon={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
            className="w-3.5 h-3.5 text-[#BBBBBB]" />
        </div>
      </button>
      {expanded && (
        <div className="bg-white mx-3 mb-3 rounded-[12px] border border-[#E6E6E6] px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{match.homeFlag}</span>
              <span className="text-sm font-bold text-[#222222]">{match.home}</span>
            </div>
            <span className="text-xs text-[#BBBBBB] font-bold">VS</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#222222]">{match.away}</span>
              <span className="text-2xl">{match.awayFlag}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TODAY = new Date().toISOString().slice(0, 10)

export default function DashboardPage() {
  const router = useRouter()
  const [me, setMe] = useState<WCUser | null>(null)
  const [users, setUsers] = useState<DBUser[]>([])
  const [bets, setBets] = useState<DBBet[]>([])
  const [results, setResults] = useState<DBResult[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scheduleView, setScheduleView] = useState<'group'|'knockout'>('group')
  const [activeDateIdx, setActiveDateIdx] = useState(0)
  const [mainTab, setMainTab] = useState<'schedule'|'mybets'|'leaderboard'>('schedule')
  const [dbLoading, setDbLoading] = useState(true)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 2000)
  }

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: uData }, { data: bData }, { data: rData }] = await Promise.all([
      supabase.from('worldcup_users').select('*').order('created_at'),
      supabase.from('worldcup_bets').select('*'),
      supabase.from('worldcup_match_results').select('*'),
    ])
    setUsers(uData ?? [])
    setBets(bData ?? [])
    setResults(rData ?? [])
    setDbLoading(false)
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session) { router.replace('/'); return }
    setMe(session)
    loadData()
  }, [router, loadData])

  const groupDates = useMemo(() =>
    [...new Set(ALL_MATCHES.filter(x=>x.stage==='group').map(x=>x.dateKST))].sort(), [])
  const knockoutStages: MatchStage[] = ['r32','r16','qf','sf','3rd','final']

  useEffect(() => {
    const idx = groupDates.findIndex(d => d >= TODAY)
    if (idx >= 0) setActiveDateIdx(idx)
  }, [groupDates])

  function formatDate(d: string) {
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getDate()}(${['일','월','화','수','목','금','토'][dt.getDay()]})`
  }

  async function handleBet(matchId: string, type: BetType, value: string) {
    if (!me) return
    const supabase = createClient()
    const existing = bets.find(b => b.user_id === me.id && b.match_id === matchId && b.bet_type === type)

    if (existing && existing.bet_value === value) {
      await supabase.from('worldcup_bets').delete().eq('id', existing.id)
      setBets(prev => prev.filter(b => b.id !== existing.id))
      showToast('픽 취소!')
    } else if (existing) {
      const { data } = await supabase.from('worldcup_bets')
        .update({ bet_value: value })
        .eq('id', existing.id)
        .select().single()
      if (data) {
        setBets(prev => prev.map(b => b.id === existing.id ? data : b))
        showToast('픽 변경!')
      }
    } else {
      const { data } = await supabase.from('worldcup_bets')
        .insert({ user_id: me.id, match_id: matchId, bet_type: type, bet_value: value })
        .select().single()
      if (data) {
        setBets(prev => [...prev, data])
        showToast('픽 저장!')
      }
    }
  }

  function handleLogout() {
    clearSession()
    router.replace('/')
  }

  if (!me || dbLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: '#011638' }}>
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const groupUserIds = new Set(users.filter(u => u.group === me.group).map(u => u.id))
  const groupBets = bets.filter(b => groupUserIds.has(b.user_id))
  const myBetCount = groupBets.filter(b => b.user_id === me.id).length

  return (
    <div className="min-h-[100dvh]" style={{ background: '#F0F4FA' }}>
      <header className="h-14 sticky top-0 z-40" style={{ background: '#011638', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-[720px] mx-auto px-4 h-full flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-white">2026 월드컵 토토</span>
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 cursor-pointer" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }} onClick={handleLogout}>
            <span className="text-xs font-semibold text-white">{me.displayName}</span>
            <Icon icon="solar:logout-2-linear" className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-4 pb-20">
        {me.isAdmin && (
          <div className="mt-4">
            <AdminPanel results={results} onSaved={loadData} />
          </div>
        )}
        <div className="rounded-[20px] p-6 mt-4 mb-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #011638 0%, #0057B8 100%)' }}>
          <div className="flex flex-col items-center mb-4">
            <Image src="/wc2026-logo.svg" alt="FIFA 2026" width={96} height={96} style={{ objectFit: 'contain' }} />
            <h1 className="text-white text-xl font-extrabold tracking-tight break-keep mt-2">
              안녕하세요, {me.displayName}님!
            </h1>
          </div>
          <div className="flex gap-3">
            {(() => {
              const myBets = groupBets.filter(b => b.user_id === me.id)
              const myCorrect = myBets.filter(b => {
                const r = results.find(r => r.match_id === b.match_id)
                return r && isCorrect(b, r)
              }).length
              const myScore = myCorrect
              const myWinRate = myBets.length > 0 ? Math.round((myCorrect / myBets.length) * 100) : 0
              return [
                { label: '내 총점', value: `${myScore}점` },
                { label: '내 승률', value: `${myWinRate}%` },
              ].map(s => (
                <div key={s.label} className="rounded-[12px] px-3 py-2 flex-1 text-center" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <p className="text-lg font-extrabold" style={{ color: '#FFB81C' }}>{s.value}</p>
                  <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.label}</p>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* 메인 탭 */}
        <div className="flex bg-white rounded-[12px] border border-[#E6E6E6] p-1 mb-4">
          {(['schedule','mybets','leaderboard'] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-[9px] transition-all duration-150 ${
                mainTab===t ? 'bg-[#011638] text-white shadow-sm' : 'text-[#8B8B8B] hover:text-[#222222]'
              }`}>
              {t==='schedule' ? '경기 일정' : t==='mybets' ? '내 베팅' : '순위표'}
            </button>
          ))}
        </div>

        {mainTab === 'mybets' ? (
          <MyBets bets={groupBets} results={results} myId={me.id} />
        ) : mainTab === 'leaderboard' ? (
          <Leaderboard users={users.filter(u => u.group === me.group)} bets={groupBets} results={results} />
        ) : (
        <section className="mb-6">

          <div className="flex gap-2 mb-3">
            {(['group','knockout'] as const).map(v => (
              <button key={v} onClick={() => { setScheduleView(v); setActiveDateIdx(0) }}
                className={`text-xs font-semibold px-4 py-2 rounded-full transition-colors ${
                  scheduleView===v ? 'bg-[#EBF3FF] border border-[#FFB81C] text-[#0057B8]' : 'bg-white border border-[#E6E6E6] text-[#222222] hover:bg-[#F5F5F5]'
                }`}>
                {v==='group' ? '⚽ 조별리그' : '🏆 토너먼트'}
              </button>
            ))}
          </div>

          {scheduleView === 'group' ? (
            <>
              <div className="grid grid-cols-9 gap-2 mb-3">
                {groupDates.map((d, i) => (
                  <button key={d} onClick={() => setActiveDateIdx(i)}
                    className={`py-2 text-xs font-semibold rounded-[10px] transition-colors ${
                      activeDateIdx === i ? 'bg-[#011638] text-white' : 'bg-white border border-[#E6E6E6] text-[#222222] hover:bg-[#F5F5F5]'
                    }`}>
                    {formatDate(d)}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {ALL_MATCHES.filter(x => x.stage === 'group' && x.dateKST === groupDates[activeDateIdx]).map(match => (
                  <MatchCard key={match.id} match={match} bets={groupBets} users={users} myId={me.id}
                    results={results} onBet={handleBet} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {knockoutStages.map(stage => {
                const sm = ALL_MATCHES.filter(x => x.stage===stage)
                if (sm.length === 0) return null
                return (
                  <div key={stage}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs font-extrabold text-[#222222]">{STAGE_LABELS[stage]}</span>
                      <span className="text-[10px] text-[#8B8B8B]">
                        {sm[0]?.dateKST.slice(5).replace('-','/')}
                        {sm.length>1 && ` ~ ${sm[sm.length-1]?.dateKST.slice(5).replace('-','/')}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {sm.map(match => (
                        <MatchCard key={match.id} match={match} bets={groupBets} users={users} myId={me.id}
                          results={results} onBet={handleBet} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        )}

        <p className="text-center text-xs text-[#BBBBBB] mt-8 break-keep">
          © 2026 김민제. All rights reserved.
        </p>
      </main>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#222222] text-white text-sm font-medium px-5 py-3 rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.16)] z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
