import { dateOf, graduationStatus, ongoingConferences, upcomingDeadlines, type GameState } from '@grad-sim/engine';
import { pack } from '../../store/gameStore';

export function Calendar({ game }: { game: GameState }) {
  const deadlines = upcomingDeadlines(pack, game, 52);
  const ongoing = ongoingConferences(pack, game);
  const g = graduationStatus(pack, game);
  return (
    <div className="calendar">
      <section>
        <h3>🎓 졸업 요건 (석사)</h3>
        <ul className="checklist">
          <li className={g.credits ? 'good' : ''}>
            {g.credits ? '✓' : '○'} 학점 {game.credits}/{pack.balance.requiredCredits}
          </li>
          <li className={g.thesis ? 'good' : ''}>{g.thesis ? '✓' : '○'} 학위논문 (마지막 학기 시작 시 생성)</li>
          <li className={g.paper ? 'good' : ''}>{g.paper ? '✓' : '○'} 논문 게재 1편 이상 (국내 학회 포함)</li>
        </ul>
      </section>
      {ongoing.length > 0 && (
        <section>
          <h3>🌏 지금 개최 중</h3>
          <p>{ongoing.map((o) => pack.venues.find((v) => v.id === o.venueId)?.displayName).join(', ')} — 플래너에서 참석 가능</p>
        </section>
      )}
      <section>
        <h3>📅 학회 마감 (향후 1년)</h3>
        <table>
          <thead>
            <tr>
              <th>학회</th>
              <th>티어</th>
              <th>마감</th>
              <th>D-day</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {deadlines.map((d) => {
              const v = pack.venues.find((x) => x.id === d.venueId)!;
              const dd = dateOf(game, d.week);
              const rd = dateOf(game, d.resultWeek);
              return (
                <tr key={`${d.venueId}-${d.year}`} className={d.week - game.week <= 3 ? 'urgent' : ''}>
                  <td>{v.displayName}</td>
                  <td>{v.tier}</td>
                  <td>
                    {dd.year}.{dd.month} {dd.weekOfMonth}주
                  </td>
                  <td>D-{(d.week - game.week) * 7}</td>
                  <td>
                    {rd.year}.{rd.month}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
