import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { ALL_MATCHES, TEAM_NAME_MAP } from '@/lib/matches'

// football-data.org 응답 타입
interface FDMatch {
  id: number
  homeTeam: { name: string }
  awayTeam: { name: string }
  score: {
    fullTime: { home: number | null; away: number | null }
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
  }
  status: string
}

interface FDResponse {
  matches: FDMatch[]
}

function toKorean(name: string): string {
  return TEAM_NAME_MAP[name] ?? name
}

export async function GET(req: Request) {
  // Vercel cron 인증 확인
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // football-data.org에서 완료된 경기 가져오기
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
    { headers: { 'X-Auth-Token': apiKey } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: `football-data API error: ${res.status}` }, { status: 502 })
  }

  const data: FDResponse = await res.json()
  const supabase = createServiceClient()

  let synced = 0
  let scored = 0

  for (const fdMatch of data.matches) {
    const homeKr = toKorean(fdMatch.homeTeam.name)
    const awayKr = toKorean(fdMatch.awayTeam.name)
    const homeScore = fdMatch.score.fullTime.home
    const awayScore = fdMatch.score.fullTime.away

    if (homeScore === null || awayScore === null) continue

    // ALL_MATCHES에서 매칭
    const localMatch = ALL_MATCHES.find(
      m => m.home === homeKr && m.away === awayKr
    )
    if (!localMatch) continue

    // 결과 결정
    let result: string
    if (fdMatch.score.winner === 'HOME_TEAM') result = '홈 승'
    else if (fdMatch.score.winner === 'AWAY_TEAM') result = '원정 승'
    else result = '무승부'

    const scoreStr = `${homeScore}:${awayScore}`
    const totalGoals = homeScore + awayScore
    const overUnder = totalGoals > 2.5 ? '오버' : '언더'

    // upsert 결과 저장
    const { error } = await supabase.from('worldcup_match_results').upsert({
      match_id: localMatch.id,
      home_score: homeScore,
      away_score: awayScore,
      result,
      score: scoreStr,
      over_under: overUnder,
    }, { onConflict: 'match_id' })

    if (error) {
      console.error(`Failed to upsert match ${localMatch.id}:`, error)
      continue
    }
    synced++

    // 베팅 점수 계산
    const { data: bets } = await supabase
      .from('worldcup_bets')
      .select('id, user_id, bet_type, bet_value, is_correct')
      .eq('match_id', localMatch.id)

    if (!bets) continue

    for (const bet of bets) {
      let isCorrect = false
      if (bet.bet_type === 'result') isCorrect = bet.bet_value === result
      else if (bet.bet_type === 'score') isCorrect = bet.bet_value === scoreStr
      else if (bet.bet_type === 'overunder') isCorrect = bet.bet_value === overUnder

      if (bet.is_correct === isCorrect) continue // 변경 없으면 스킵

      await supabase
        .from('worldcup_bets')
        .update({ is_correct: isCorrect })
        .eq('id', bet.id)

      scored++
    }
  }

  return NextResponse.json({ synced, scored, total: data.matches.length })
}
