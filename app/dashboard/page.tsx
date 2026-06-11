'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { getSession, clearSession, type WCUser } from '@/lib/worldcup-auth'

type BetType = 'result' | 'score' | 'overunder'
type MatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final'

interface DBUser   { id: string; username: string; display_name: string; color: string; is_admin: boolean; group: string }
interface DBBet    { id: string; user_id: string; match_id: string; bet_type: BetType; bet_value: string }
interface DBResult {
  match_id: string
  result: string
  home_score: number
  away_score: number
  first_scorer: string
}

interface Match {
  id: string; dateKST: string; timeKST: string
  home: string; away: string; homeFlag: string; awayFlag: string
  group: string; venue: string; stage: MatchStage
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

const FLAGS: Record<string, string> = {
  '멕시코':'🇲🇽','남아프리카공화국':'🇿🇦','대한민국':'🇰🇷','체코':'🇨🇿',
  '캐나다':'🇨🇦','보스니아헤르체고비나':'🇧🇦','미국':'🇺🇸','파라과이':'🇵🇾',
  '카타르':'🇶🇦','스위스':'🇨🇭','브라질':'🇧🇷','모로코':'🇲🇦',
  '아이티':'🇭🇹','스코틀랜드':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','호주':'🇦🇺','튀르키예':'🇹🇷',
  '독일':'🇩🇪','퀴라소':'🇨🇼','네덜란드':'🇳🇱','일본':'🇯🇵',
  '코트디부아르':'🇨🇮','에콰도르':'🇪🇨','스웨덴':'🇸🇪','튀니지':'🇹🇳',
  '스페인':'🇪🇸','카보베르데':'🇨🇻','벨기에':'🇧🇪','이집트':'🇪🇬',
  '사우디아라비아':'🇸🇦','우루과이':'🇺🇾','이란':'🇮🇷','뉴질랜드':'🇳🇿',
  '프랑스':'🇫🇷','세네갈':'🇸🇳','이라크':'🇮🇶','노르웨이':'🇳🇴',
  '아르헨티나':'🇦🇷','알제리':'🇩🇿','오스트리아':'🇦🇹','요르단':'🇯🇴',
  '포르투갈':'🇵🇹','콩고민주공화국':'🇨🇩','잉글랜드':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','크로아티아':'🇭🇷',
  '가나':'🇬🇭','파나마':'🇵🇦','콜롬비아':'🇨🇴','우즈베키스탄':'🇺🇿',
}

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

function mk(id:string,date:string,time:string,home:string,away:string,group:string,venue:string,stage:MatchStage='group'):Match{
  return{id,dateKST:date,timeKST:time,home,away,homeFlag:FLAGS[home]??'🏳️',awayFlag:FLAGS[away]??'🏳️',group,venue,stage}
}

const ALL_MATCHES: Match[] = [
  mk('a1','2026-06-12','04:00','멕시코','남아프리카공화국','A조','에스타디오 아스테카, 멕시코시티'),
  mk('a2','2026-06-12','11:00','대한민국','체코','A조','에스타디오 아크론, 과달라하라'),
  mk('b1','2026-06-13','04:00','캐나다','보스니아헤르체고비나','B조','BMO 필드, 토론토'),
  mk('d1','2026-06-13','10:00','미국','파라과이','D조','소파이 스타디움, 로스앤젤레스'),
  mk('b2','2026-06-14','04:00','카타르','스위스','B조','리바이스 스타디움, 샌프란시스코'),
  mk('c1','2026-06-14','07:00','브라질','모로코','C조','메트라이프 스타디움, 뉴저지'),
  mk('c2','2026-06-14','10:00','아이티','스코틀랜드','C조','질레트 스타디움, 보스턴'),
  mk('d2','2026-06-14','13:00','호주','튀르키예','D조','BC플레이스, 밴쿠버'),
  mk('e1','2026-06-15','02:00','독일','퀴라소','E조','NRG 스타디움, 휴스턴'),
  mk('f1','2026-06-15','05:00','네덜란드','일본','F조','AT&T 스타디움, 댈러스'),
  mk('e2','2026-06-15','08:00','코트디부아르','에콰도르','E조','링컨 파이낸셜 필드, 필라델피아'),
  mk('f2','2026-06-15','11:00','스웨덴','튀니지','F조','에스타디오 BBVA, 몬테레이'),
  mk('h1','2026-06-16','01:00','스페인','카보베르데','H조','메르세데스-벤츠 스타디움, 애틀랜타'),
  mk('g1','2026-06-16','04:00','벨기에','이집트','G조','루멘 필드, 시애틀'),
  mk('h2','2026-06-16','07:00','사우디아라비아','우루과이','H조','하드록 스타디움, 마이애미'),
  mk('g2','2026-06-16','10:00','이란','뉴질랜드','G조','소파이 스타디움, 로스앤젤레스'),
  mk('i1','2026-06-17','04:00','프랑스','세네갈','I조','메트라이프 스타디움, 뉴저지'),
  mk('i2','2026-06-17','07:00','이라크','노르웨이','I조','질레트 스타디움, 보스턴'),
  mk('j1','2026-06-17','10:00','아르헨티나','알제리','J조','어라웨드 스타디움, 캔자스시티'),
  mk('j2','2026-06-17','13:00','오스트리아','요르단','J조','리바이스 스타디움, 샌프란시스코'),
  mk('k1','2026-06-18','02:00','포르투갈','콩고민주공화국','K조','NRG 스타디움, 휴스턴'),
  mk('l1','2026-06-18','05:00','잉글랜드','크로아티아','L조','AT&T 스타디움, 댈러스'),
  mk('l2','2026-06-18','08:00','가나','파나마','L조','BMO 필드, 토론토'),
  mk('k2','2026-06-18','11:00','우즈베키스탄','콜롬비아','K조','에스타디오 아스테카, 멕시코시티'),
  mk('a3','2026-06-19','01:00','체코','남아프리카공화국','A조','메르세데스-벤츠 스타디움, 애틀랜타'),
  mk('b3','2026-06-19','04:00','스위스','보스니아헤르체고비나','B조','소파이 스타디움, 로스앤젤레스'),
  mk('b4','2026-06-19','07:00','캐나다','카타르','B조','BC플레이스, 밴쿠버'),
  mk('a4','2026-06-19','10:00','멕시코','대한민국','A조','에스타디오 아크론, 과달라하라'),
  mk('d3','2026-06-20','04:00','미국','호주','D조','루멘 필드, 시애틀'),
  mk('c3','2026-06-20','07:00','스코틀랜드','모로코','C조','질레트 스타디움, 보스턴'),
  mk('c4','2026-06-20','09:30','브라질','아이티','C조','링컨 파이낸셜 필드, 필라델피아'),
  mk('d4','2026-06-20','12:00','튀르키예','파라과이','D조','리바이스 스타디움, 샌프란시스코'),
  mk('f3','2026-06-21','02:00','네덜란드','스웨덴','F조','NRG 스타디움, 휴스턴'),
  mk('e3','2026-06-21','05:00','독일','코트디부아르','E조','BMO 필드, 토론토'),
  mk('e4','2026-06-21','09:00','에콰도르','퀴라소','E조','어라웨드 스타디움, 캔자스시티'),
  mk('f4','2026-06-21','13:00','튀니지','일본','F조','에스타디오 BBVA, 몬테레이'),
  mk('h3','2026-06-22','01:00','스페인','사우디아라비아','H조','메르세데스-벤츠 스타디움, 애틀랜타'),
  mk('g3','2026-06-22','04:00','벨기에','이란','G조','소파이 스타디움, 로스앤젤레스'),
  mk('h4','2026-06-22','07:00','우루과이','카보베르데','H조','하드록 스타디움, 마이애미'),
  mk('g4','2026-06-22','10:00','뉴질랜드','이집트','G조','BC플레이스, 밴쿠버'),
  mk('j3','2026-06-23','02:00','아르헨티나','오스트리아','J조','AT&T 스타디움, 댈러스'),
  mk('i3','2026-06-23','06:00','프랑스','이라크','I조','링컨 파이낸셜 필드, 필라델피아'),
  mk('i4','2026-06-23','09:00','노르웨이','세네갈','I조','메트라이프 스타디움, 뉴저지'),
  mk('j4','2026-06-23','12:00','요르단','알제리','J조','리바이스 스타디움, 샌프란시스코'),
  mk('k3','2026-06-24','02:00','포르투갈','우즈베키스탄','K조','NRG 스타디움, 휴스턴'),
  mk('l3','2026-06-24','05:00','잉글랜드','가나','L조','질레트 스타디움, 보스턴'),
  mk('l4','2026-06-24','08:00','파나마','크로아티아','L조','BMO 필드, 토론토'),
  mk('k4','2026-06-24','11:00','콜롬비아','콩고민주공화국','K조','에스타디오 아크론, 과달라하라'),
  mk('b5','2026-06-25','04:00','스위스','캐나다','B조','BC플레이스, 밴쿠버'),
  mk('b6','2026-06-25','04:00','보스니아헤르체고비나','카타르','B조','루멘 필드, 시애틀'),
  mk('c5','2026-06-25','07:00','스코틀랜드','브라질','C조','하드록 스타디움, 마이애미'),
  mk('c6','2026-06-25','07:00','모로코','아이티','C조','메르세데스-벤츠 스타디움, 애틀랜타'),
  mk('a5','2026-06-25','10:00','체코','멕시코','A조','에스타디오 아스테카, 멕시코시티'),
  mk('a6','2026-06-25','10:00','남아프리카공화국','대한민국','A조','에스타디오 BBVA, 몬테레이'),
  mk('e5','2026-06-26','05:00','퀴라소','코트디부아르','E조','링컨 파이낸셜 필드, 필라델피아'),
  mk('e6','2026-06-26','05:00','에콰도르','독일','E조','메트라이프 스타디움, 뉴저지'),
  mk('f5','2026-06-26','08:00','일본','스웨덴','F조','AT&T 스타디움, 댈러스'),
  mk('f6','2026-06-26','08:00','튀니지','네덜란드','F조','어라웨드 스타디움, 캔자스시티'),
  mk('d5','2026-06-26','11:00','튀르키예','미국','D조','소파이 스타디움, 로스앤젤레스'),
  mk('d6','2026-06-26','11:00','파라과이','호주','D조','리바이스 스타디움, 샌프란시스코'),
  mk('i5','2026-06-27','04:00','노르웨이','프랑스','I조','질레트 스타디움, 보스턴'),
  mk('i6','2026-06-27','04:00','세네갈','이라크','I조','BMO 필드, 토론토'),
  mk('h5','2026-06-27','09:00','카보베르데','사우디아라비아','H조','NRG 스타디움, 휴스턴'),
  mk('h6','2026-06-27','09:00','우루과이','스페인','H조','에스타디오 아크론, 과달라하라'),
  mk('g5','2026-06-27','12:00','이집트','이란','G조','루멘 필드, 시애틀'),
  mk('g6','2026-06-27','12:00','뉴질랜드','벨기에','G조','BC플레이스, 밴쿠버'),
  mk('l5','2026-06-28','06:00','파나마','잉글랜드','L조','메트라이프 스타디움, 뉴저지'),
  mk('l6','2026-06-28','06:00','크로아티아','가나','L조','링컨 파이낸셜 필드, 필라델피아'),
  mk('k5','2026-06-28','08:30','콜롬비아','포르투갈','K조','하드록 스타디움, 마이애미'),
  mk('k6','2026-06-28','08:30','콩고민주공화국','우즈베키스탄','K조','메르세데스-벤츠 스타디움, 애틀랜타'),
  mk('j5','2026-06-28','11:00','알제리','오스트리아','J조','어라웨드 스타디움, 캔자스시티'),
  mk('j6','2026-06-28','11:00','요르단','아르헨티나','J조','AT&T 스타디움, 댈러스'),
  mk('r32_1','2026-06-29','04:00','A조 2위','B조 2위','32강','소파이 스타디움, 로스앤젤레스','r32'),
  mk('r32_2','2026-06-30','02:00','C조 1위','F조 2위','32강','NRG 스타디움, 휴스턴','r32'),
  mk('r32_3','2026-06-30','05:30','E조 1위','3위팀','32강','질레트 스타디움, 보스턴','r32'),
  mk('r32_4','2026-06-30','10:00','F조 1위','C조 2위','32강','에스타디오 BBVA, 몬테레이','r32'),
  mk('r32_5','2026-07-01','02:00','E조 2위','I조 2위','32강','AT&T 스타디움, 댈러스','r32'),
  mk('r32_6','2026-07-01','06:00','I조 1위','3위팀','32강','메트라이프 스타디움, 뉴저지','r32'),
  mk('r32_7','2026-07-01','10:00','A조 1위','3위팀','32강','에스타디오 아스테카, 멕시코시티','r32'),
  mk('r32_8','2026-07-02','01:00','L조 1위','3위팀','32강','메르세데스-벤츠 스타디움, 애틀랜타','r32'),
  mk('r32_9','2026-07-02','05:00','G조 1위','3위팀','32강','루멘 필드, 시애틀','r32'),
  mk('r32_10','2026-07-02','09:00','D조 1위','3위팀','32강','리바이스 스타디움, 샌프란시스코','r32'),
  mk('r32_11','2026-07-03','04:00','H조 1위','J조 2위','32강','소파이 스타디움, 로스앤젤레스','r32'),
  mk('r32_12','2026-07-03','08:00','K조 2위','L조 2위','32강','BMO 필드, 토론토','r32'),
  mk('r32_13','2026-07-03','12:00','B조 1위','3위팀','32강','BC플레이스, 밴쿠버','r32'),
  mk('r32_14','2026-07-04','03:00','D조 2위','G조 2위','32강','AT&T 스타디움, 댈러스','r32'),
  mk('r32_15','2026-07-04','07:00','J조 1위','H조 2위','32강','하드록 스타디움, 마이애미','r32'),
  mk('r32_16','2026-07-04','10:30','K조 1위','3위팀','32강','어라웨드 스타디움, 캔자스시티','r32'),
  mk('r16_1','2026-07-05','02:00','32강 승자','32강 승자','16강','NRG 스타디움, 휴스턴','r16'),
  mk('r16_2','2026-07-05','06:00','32강 승자','32강 승자','16강','링컨 파이낸셜 필드, 필라델피아','r16'),
  mk('r16_3','2026-07-06','05:00','32강 승자','32강 승자','16강','메트라이프 스타디움, 뉴저지','r16'),
  mk('r16_4','2026-07-06','09:00','32강 승자','32강 승자','16강','에스타디오 아스테카, 멕시코시티','r16'),
  mk('r16_5','2026-07-07','04:00','32강 승자','32강 승자','16강','AT&T 스타디움, 댈러스','r16'),
  mk('r16_6','2026-07-07','09:00','32강 승자','32강 승자','16강','루멘 필드, 시애틀','r16'),
  mk('r16_7','2026-07-08','01:00','32강 승자','32강 승자','16강','메르세데스-벤츠 스타디움, 애틀랜타','r16'),
  mk('r16_8','2026-07-08','05:00','32강 승자','32강 승자','16강','BC플레이스, 밴쿠버','r16'),
  mk('qf1','2026-07-10','05:00','16강 승자','16강 승자','8강','질레트 스타디움, 보스턴','qf'),
  mk('qf2','2026-07-11','04:00','16강 승자','16강 승자','8강','소파이 스타디움, 로스앤젤레스','qf'),
  mk('qf3','2026-07-12','06:00','16강 승자','16강 승자','8강','하드록 스타디움, 마이애미','qf'),
  mk('qf4','2026-07-12','10:00','16강 승자','16강 승자','8강','어라웨드 스타디움, 캔자스시티','qf'),
  mk('sf1','2026-07-15','04:00','8강 승자','8강 승자','4강','AT&T 스타디움, 댈러스','sf'),
  mk('sf2','2026-07-16','04:00','8강 승자','8강 승자','4강','메르세데스-벤츠 스타디움, 애틀랜타','sf'),
  mk('p3','2026-07-19','06:00','4강 패자','4강 패자','3·4위전','하드록 스타디움, 마이애미','3rd'),
  mk('final','2026-07-20','04:00','4강 승자','4강 승자','결승','메트라이프 스타디움, 뉴저지','final'),
]

function isLocked(match: Match): boolean {
  const matchTime = new Date(`${match.dateKST}T${match.timeKST}:00+09:00`)
  return Date.now() >= matchTime.getTime() - 5 * 60 * 1000
}

function isCorrect(bet: DBBet, result: DBResult): boolean {
  if (bet.bet_type === 'result') return bet.bet_value === result.result
  if (bet.bet_type === 'score') return bet.bet_value === `${result.home_score}:${result.away_score}`
  if (bet.bet_type === 'overunder') {
    const total = result.home_score + result.away_score
    if (bet.bet_value === '언더 2.5') return total <= 2
    if (bet.bet_value === '오버 2.5') return total >= 3
    if (bet.bet_value === '언더 3.5') return total <= 3
    if (bet.bet_value === '오버 3.5') return total >= 4
  }
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
    return `${dt.getMonth()+1}/${dt.getDate()}(${['일','월','화','수','목','금','토'][dt.getDay()]})`
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
            <div className="flex flex-col gap-6">
              {groupDates.map(d => {
                const dayMatches = ALL_MATCHES.filter(x => x.stage === 'group' && x.dateKST === d)
                if (dayMatches.length === 0) return null
                return (
                  <div key={d}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs font-extrabold text-[#222222]">{formatDate(d)}</span>
                      <span className="text-[10px] text-[#8B8B8B]">{dayMatches.length}경기</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {dayMatches.map(match => (
                        <MatchCard key={match.id} match={match} bets={groupBets} users={users} myId={me.id}
                          results={results} onBet={handleBet} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
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
