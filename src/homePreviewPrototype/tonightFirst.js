/*
 * PROTOTYPE — throwaway. T/U/V: Matchups and Targets lead the home page; the
 * game-log search drops to a compact bar (the real form, restyled by
 * `.hp-compact-search`).
 */
import LandingCourt from '../LandingCourt';
import { DEMO_DATE } from './prototypeMode';
import { biggestPtsEffects, bestEdgeInGame } from './useHomePreviewData';
import { EdgeValue, ProtoLink, TargetCard, gameLabel, lastName, shortName, tipoff } from './parts';
import { LadderPath, SlimSpot } from './hooks';
import hooks from './mock/hooks.json';

const slateDay = new Date(`${DEMO_DATE}T12:00:00`).toLocaleDateString([], {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const firingIn = (targets, gameId) =>
  targets ? targets.firing.filter((entry) => entry.game.gameId === gameId) : [];

const CompactSearch = ({ hero, label = 'Search game logs' }) => (
  <div className="hp-compact-search">
    <span className="hp-compact-label">{label}</span>
    {hero}
  </div>
);

const GameCard = ({ game, targets }) => {
  const fires = firingIn(targets, game.gameId);
  return (
    <ProtoLink to={`/matchups/${game.gameId}`} className="hp-gcard">
      <div className="hp-gcard-head">
        <span className="hp-gcard-teams">{gameLabel(game)}</span>
        <span className="hp-gcard-time">{tipoff(game.scheduledAt)}</span>
      </div>
      <ul>
        {biggestPtsEffects(game.gameId).map((player) => (
          <li key={player.id}>
            <span>
              {lastName(player.name)} <small>{player.tricode}</small>
            </span>
            <EdgeValue value={player.value} />
          </li>
        ))}
      </ul>
      {fires.length > 0 && (
        <span className="hp-gcard-fires">
          {fires.length} {fires.length === 1 ? 'Target fires' : 'Targets fire'}
        </span>
      )}
    </ProtoLink>
  );
};

const Headline = ({ slate, targets, children }) => (
  <header className="hp-tf-head">
    <span className="hp-kicker">{slateDay}</span>
    <h1 className="hp-tf-title">Tonight</h1>
    <p className="hp-tf-sub">
      {slate ? `${slate.games.length} games` : '…'}
      {targets && (
        <>
          {' · '}
          <b>{targets.firing.length}</b> of your {targets.total} Targets firing
        </>
      )}
    </p>
    {children}
  </header>
);

/* T: the slate as a board, Targets alongside. */
export const VariantT = ({ hero, data }) => {
  const { slate, targets } = data;
  return (
    <div className="hp-tf hp-t">
      <Headline slate={slate} targets={targets}>
        <CompactSearch hero={hero} />
      </Headline>
      <div className="hp-t-body">
        <section aria-label="Matchups tonight">
          <div className="hp-section-head">
            <h2 className="hp-section-title">Matchups</h2>
            <ProtoLink to="/matchups" className="hp-more">
              Open Matchups →
            </ProtoLink>
          </div>
          <p className="hp-tf-note">Biggest points matchup effects in each game, either way.</p>
          <div className="hp-t-grid">
            {slate?.games.map((game) => (
              <GameCard key={game.gameId} game={game} targets={targets} />
            ))}
          </div>
        </section>
        <aside aria-label="Your Targets tonight">
          <div className="hp-section-head">
            <h2 className="hp-section-title">Your Targets</h2>
            <ProtoLink to="/targets" className="hp-more">
              All →
            </ProtoLink>
          </div>
          <div className="hp-t-targets">
            {targets?.firing.slice(0, 3).map((entry) => (
              <TargetCard key={entry.target.id} entry={entry} withMatchup />
            ))}
            {targets && targets.firing.length > 3 && (
              <ProtoLink to="/targets" className="hp-side-more">
                +{targets.firing.length - 3} more firing
              </ProtoLink>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

/* U: the court hero, rewritten around tonight's edges. */
export const VariantU = ({ hero, data, onUseQuery }) => {
  const { slate, targets } = data;
  const gameOf = (pick) => slate?.games.find((game) => game.gameId === pick.gameId);
  const { best, worst } = hooks.spotlight;
  return (
    <div className="hp-tf hp-u">
      <div className="landing-hero hp-u-hero">
        <LandingCourt />
        <div className="hp-flank hp-calm">
          <div className="hp-flank-side hp-flank-left">
            <SlimSpot
              kind="Best matchup tonight"
              pick={best}
              game={gameOf(best)}
              onUseQuery={onUseQuery}
            />
          </div>
          <div className="hp-flank-center hp-u-center">
            <span className="hp-kicker">{slateDay}</span>
            <h1 className="landing-title">
              Find the <em>edge</em>
            </h1>
            <p className="landing-tagline">
              {slate ? `${slate.games.length} games tonight` : 'Tonight'}
              {targets && `, and ${targets.firing.length} of your Targets are firing.`}
            </p>
            <div className="hp-u-ctas">
              <ProtoLink to="/matchups" className="hp-u-cta is-primary">
                Open tonight's Matchups
              </ProtoLink>
              <ProtoLink to="/targets" className="hp-u-cta">
                Your Targets
              </ProtoLink>
            </div>
          </div>
          <div className="hp-flank-side hp-flank-right">
            <SlimSpot
              kind="Toughest matchup tonight"
              pick={worst}
              game={gameOf(worst)}
              onUseQuery={onUseQuery}
            />
          </div>
        </div>
      </div>
      <section className="hp-u-targets" aria-label="Your Targets firing tonight">
        <div className="hp-section-head">
          <h2 className="hp-section-title">Firing tonight</h2>
          <ProtoLink to="/targets" className="hp-more">
            All {targets?.firing.length} →
          </ProtoLink>
        </div>
        <div className="hp-u-target-row">
          {targets?.firing.slice(0, 3).map((entry) => (
            <TargetCard key={entry.target.id} entry={entry} withMatchup />
          ))}
        </div>
      </section>
      <section className="hp-u-search" aria-label="Search game logs">
        <CompactSearch hero={hero} label="Or ask the box score" />
        <LadderPath onUseQuery={onUseQuery} />
      </section>
    </div>
  );
};

/* V: two equal doors under a centred headline. */
export const VariantV = ({ hero, data }) => {
  const { slate, targets } = data;
  const games = slate
    ? [...slate.games]
        .map((game) => ({ game, edge: bestEdgeInGame(game.gameId) }))
        .sort((a, b) => (b.edge?.value ?? 0) - (a.edge?.value ?? 0))
        .slice(0, 6)
    : [];
  return (
    <div className="hp-tf hp-v">
      <Headline slate={slate} targets={targets}>
        <CompactSearch hero={hero} />
      </Headline>
      <div className="hp-v-doors">
        <section className="hp-v-door" aria-label="Matchups">
          <div className="hp-v-door-head">
            <h2>Matchups</h2>
            <span>Best edge in each game</span>
          </div>
          <ol className="hp-v-list">
            {games.map(({ game, edge }) => (
              <li key={game.gameId}>
                <ProtoLink to={`/matchups/${game.gameId}`} className="hp-v-row">
                  <span className="hp-v-teams">{gameLabel(game)}</span>
                  <span className="hp-v-who">{edge && shortName(edge.name)}</span>
                  {edge && <EdgeValue value={edge.value} market={edge.market} />}
                </ProtoLink>
              </li>
            ))}
          </ol>
          <ProtoLink to="/matchups" className="hp-v-open">
            All {slate?.games.length} games →
          </ProtoLink>
        </section>
        <section className="hp-v-door" aria-label="Targets">
          <div className="hp-v-door-head">
            <h2>Targets</h2>
            <span>Firing tonight</span>
          </div>
          <ol className="hp-v-list">
            {targets?.firing.map((entry) => (
              <li key={entry.target.id}>
                <ProtoLink to={`/targets/${entry.target.id}`} className="hp-v-row">
                  <span className="hp-opp">vs {entry.target.opponent}</span>
                  <span className="hp-v-who">{shortName(entry.players[0].name)}</span>
                  <span className="hp-v-count">
                    {entry.players.length} {entry.players.length === 1 ? 'player' : 'players'}
                  </span>
                </ProtoLink>
              </li>
            ))}
          </ol>
          <ProtoLink to="/targets" className="hp-v-open">
            All {targets?.total} Targets →
          </ProtoLink>
        </section>
      </div>
    </div>
  );
};
