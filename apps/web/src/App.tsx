import { Contact } from './scenes/Contact';
import { Career, Ending } from './scenes/Ending';
import { Main } from './scenes/Main';
import { NewGame } from './scenes/NewGame';
import { Ranking } from './scenes/Ranking';
import { Title } from './scenes/Title';
import { useGame } from './store/gameStore';

export function App() {
  const { screen, game, toast, clearToast } = useGame();

  let view;
  if (screen === 'title') view = <Title />;
  else if (screen === 'new') view = <NewGame />;
  else if (screen === 'ranking') view = <Ranking />;
  else if (!game) view = <Title />;
  else if (game.phase === 'contact') view = <Contact />;
  else if (game.phase === 'career') view = <Career game={game} />;
  else if (game.phase === 'ended') view = <Ending game={game} />;
  else view = <Main game={game} />;

  return (
    <>
      {view}
      {toast && (
        <button className="toast" onClick={clearToast}>
          {toast}
        </button>
      )}
    </>
  );
}
