/*
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Question: should the home page preview Matchups and Targets, and how?
 * Four layouts on the real home (`/`), switchable via `#proto=home&v=…`.
 * The real hero (court, headline, search) and the query ladder are passed in
 * untouched; each variant decides where they and the previews sit.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PrototypeSwitcher from './PrototypeSwitcher';
import { DEMO_DATE } from './prototypeMode';
import {
  bestEdgeInGame,
  biggestPtsEffects,
  topEdges,
  useHomePreviewData,
} from './useHomePreviewData';
import {
  EdgeRow,
  EdgeValue,
  GameTile,
  ProtoLink,
  SectionHead,
  TargetCard,
  gameLabel,
  lastName,
  qualifierText,
  shortName,
  tipoff,
} from './parts';
import hooks from './mock/hooks.json';
import { AnswerLadder, Spotlight, SpotlightCard } from './hooks';
import './prototype.css';

const slateDay = new Date(`${DEMO_DATE}T12:00:00`).toLocaleDateString([], {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const Loading = () => <p className="hp-loading">Loading tonight…</p>;

/* A: the ask — two Targets in a sidebar, a slate strip under the search. */
const VariantA = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  const targetsBlock = (
    <>
      <SectionHead
        kicker="Your Targets"
        title={targets ? `${targets.firing.length} firing tonight` : 'Firing tonight'}
        to="/targets"
        cta="All"
      />
      {targets ? (
        <>
          {targets.firing.slice(0, 2).map((entry) => (
            <TargetCard key={entry.target.id} entry={entry} />
          ))}
          {targets.firing.length > 2 && (
            <ProtoLink to="/targets" className="hp-side-more">
              +{targets.firing.length - 2} more firing · {targets.total - targets.firing.length}{' '}
              idle
            </ProtoLink>
          )}
        </>
      ) : (
        <Loading />
      )}
    </>
  );
  return (
    <div className="hp-a">
      <div className="hp-a-main">
        {hero}
        <section className="hp-a-strip" aria-label="Tonight's slate">
          <SectionHead
            kicker={slateDay}
            title={slate ? `Tonight · ${slate.games.length} games` : 'Tonight'}
            to="/matchups"
            cta="All matchups"
          />
          {slate ? (
            <div className="hp-strip-scroll">
              {slate.games.map((game) => (
                <GameTile key={game.gameId} game={game} edge={bestEdgeInGame(game.gameId)} />
              ))}
            </div>
          ) : (
            <Loading />
          )}
        </section>
        {/* Phone: the sidebar has nowhere to sit, so it follows the strip. */}
        <section className="hp-a-inline" aria-label="Your Targets tonight">
          {targetsBlock}
        </section>
        {ladder}
      </div>
      <aside className="hp-a-side" aria-label="Your Targets tonight">
        {targetsBlock}
      </aside>
    </div>
  );
};

/* B: hero untouched; a "Tonight" board (scoreboard + Targets) right under it. */
const VariantB = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  return (
    <div className="hp-b">
      <div className="landing-container">{hero}</div>
      <section className="hp-b-board" aria-label="Tonight">
        <div className="hp-b-col">
          <SectionHead
            kicker={slateDay}
            title="Tonight's slate"
            to="/matchups"
            cta="Open Matchups"
          />
          {slate ? (
            <ol className="hp-scoreboard">
              {slate.games.map((game) => {
                const edge = bestEdgeInGame(game.gameId);
                return (
                  <li key={game.gameId}>
                    <ProtoLink to={`/matchups/${game.gameId}`} className="hp-sb-row">
                      <span className="hp-sb-time">{tipoff(game.scheduledAt)}</span>
                      <span className="hp-sb-teams">{gameLabel(game)}</span>
                      {edge && (
                        <span className="hp-sb-edge">
                          <span>{shortName(edge.name)}</span>
                          <EdgeValue value={edge.value} market={edge.market} />
                        </span>
                      )}
                    </ProtoLink>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Loading />
          )}
        </div>
        <div className="hp-b-col hp-b-targets">
          <SectionHead
            kicker="Your Targets"
            title={targets ? `${targets.firing.length} of ${targets.total} firing` : 'Firing'}
            to="/targets"
            cta="All Targets"
          />
          {targets ? (
            targets.firing
              .slice(0, 2)
              .map((entry) => <TargetCard key={entry.target.id} entry={entry} />)
          ) : (
            <Loading />
          )}
        </div>
      </section>
      <div className="landing-container">{ladder}</div>
    </div>
  );
};

/* C: least intrusion — a scoreboard ticker above, Target pills under search. */
const VariantC = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  return (
    <div className="hp-c">
      <div className="hp-ticker" aria-label="Tonight's slate">
        <ProtoLink to="/matchups" className="hp-ticker-label">
          {slateDay}
          <b>{slate ? slate.games.length : '–'} games</b>
        </ProtoLink>
        <div className="hp-ticker-track">
          {slate?.games.map((game) => {
            const edge = bestEdgeInGame(game.gameId);
            return (
              <ProtoLink key={game.gameId} to={`/matchups/${game.gameId}`} className="hp-tick">
                <span className="hp-tick-teams">{gameLabel(game)}</span>
                <span className="hp-tick-time">{tipoff(game.scheduledAt)}</span>
                {edge && (
                  <span className="hp-tick-edge">
                    {edge.name.split(' ').slice(-1)[0]}{' '}
                    <EdgeValue value={edge.value} market={edge.market} />
                  </span>
                )}
              </ProtoLink>
            );
          })}
        </div>
      </div>
      <div className="landing-container">
        {hero}
        {targets && targets.firing.length > 0 && (
          <div className="hp-c-pills" aria-label="Your Targets firing tonight">
            <span className="hp-c-pills-label">Firing tonight</span>
            {targets.firing.slice(0, 2).map((entry) => (
              <ProtoLink
                key={entry.target.id}
                to={`/targets/${entry.target.id}`}
                className="hp-pill"
              >
                <span className="hp-opp">vs {entry.target.opponent}</span>
                <span className="hp-pill-crit">
                  {entry.target.qualifiers.map(qualifierText).join(' · ')}
                </span>
                <span className="hp-pill-count">{entry.players.length}</span>
              </ProtoLink>
            ))}
            {targets.firing.length > 2 && (
              <ProtoLink to="/targets" className="hp-pill hp-pill-more">
                +{targets.firing.length - 2}
              </ProtoLink>
            )}
          </div>
        )}
        {ladder}
      </div>
    </div>
  );
};

/* D: depth over breadth — one featured game as a mini Matchup, with the
   Targets that fire in it, then the rest of the slate as chips. */
const VariantD = ({ hero, ladder, data }) => {
  const { slate, targets } = data;
  const [open, setOpen] = useState(false);
  // Feature the game with the strongest PTS matchups on both sides; each
  // Target firing in it adds weight.
  const weight = (game) =>
    [game.away.tricode, game.home.tricode]
      .flatMap((tricode) => topEdges(game.gameId, { tricode }))
      .reduce((sum, player) => sum + player.value, 0) +
    (targets ? targets.firing.filter((t) => t.game.gameId === game.gameId).length * 0.05 : 0);
  const featured = slate ? [...slate.games].sort((a, b) => weight(b) - weight(a))[0] : null;
  const featuredTargets =
    featured && targets ? targets.firing.filter((t) => t.game.gameId === featured.gameId) : [];
  const rest = slate ? slate.games.filter((game) => game !== featured) : [];
  return (
    <div className="hp-d">
      <div className="landing-container">{hero}</div>
      <section className="hp-d-feature" aria-label="Game of the night">
        {featured ? (
          <>
            <div className="hp-d-head">
              <div>
                <span className="hp-kicker">Game of the night · {slateDay}</span>
                <h2 className="hp-d-title">
                  {featured.away.tricode} <i>@</i> {featured.home.tricode}
                  <small>{tipoff(featured.scheduledAt)}</small>
                </h2>
              </div>
              <ProtoLink to={`/matchups/${featured.gameId}`} className="hp-d-open">
                Open Matchup
              </ProtoLink>
            </div>
            <div className="hp-d-sides">
              {[featured.away, featured.home].map((team) => (
                <div key={team.tricode} className="hp-d-side">
                  <h3>
                    {team.tricode} <small>best PTS matchups</small>
                  </h3>
                  <ul>
                    {topEdges(featured.gameId, { tricode: team.tricode }).map((player) => (
                      <EdgeRow key={player.id} player={player} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {featuredTargets.length > 0 && (
              <div className="hp-d-targets">
                <span className="hp-kicker">Your Targets in this game</span>
                <div className="hp-d-target-row">
                  {featuredTargets.slice(0, 2).map((entry) => (
                    <TargetCard key={entry.target.id} entry={entry} density="compact" />
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="hp-d-rest-toggle" onClick={() => setOpen(!open)}>
              {rest.length} more games tonight
              {targets &&
                ` · ${targets.firing.length - featuredTargets.length} more Targets firing`}
              <ChevronDown size={14} className={open ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {open && (
              <div className="hp-d-rest">
                {rest.map((game) => (
                  <GameTile key={game.gameId} game={game} edge={bestEdgeInGame(game.gameId)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <Loading />
        )}
      </section>
      <div className="landing-container">{ladder}</div>
    </div>
  );
};

/* E: C's ticker on its own, no Targets. Each game shows its three biggest
   points Matchup effects, favourable or not. */
const VariantE = ({ hero, ladder, data, middle = null, heroSlot = null }) => {
  const { slate } = data;
  return (
    <div className="hp-c hp-e">
      <div className="hp-ticker" aria-label="Tonight's slate">
        <ProtoLink to="/matchups" className="hp-ticker-label">
          {slateDay}
          <b>{slate ? slate.games.length : '–'} games</b>
          <span className="hp-e-legend">PTS matchup</span>
        </ProtoLink>
        <div className="hp-ticker-track">
          {slate?.games.map((game) => (
            <ProtoLink
              key={game.gameId}
              to={`/matchups/${game.gameId}`}
              className="hp-tick hp-e-tick"
            >
              <span className="hp-tick-teams">{gameLabel(game)}</span>
              <span className="hp-tick-time">{tipoff(game.scheduledAt)}</span>
              <ul className="hp-e-effects">
                {biggestPtsEffects(game.gameId).map((player) => (
                  <li key={player.id}>
                    <span>
                      {lastName(player.name)} <small>{player.tricode}</small>
                    </span>
                    <EdgeValue value={player.value} />
                  </li>
                ))}
              </ul>
            </ProtoLink>
          ))}
        </div>
      </div>
      <div className="landing-container">
        {heroSlot || hero}
        {middle}
        {ladder}
      </div>
    </div>
  );
};

/* F/G/H: E's ticker plus a reason to stay. */
const VariantF = (props) => (
  <VariantE
    {...props}
    middle={<Spotlight slate={props.data.slate} onUseQuery={props.onUseQuery} />}
  />
);
const VariantG = (props) => (
  <VariantE {...props} ladder={<AnswerLadder onUseQuery={props.onUseQuery} />} />
);
const VariantH = (props) => (
  <VariantE
    {...props}
    middle={<Spotlight slate={props.data.slate} onUseQuery={props.onUseQuery} />}
    ladder={<AnswerLadder onUseQuery={props.onUseQuery} />}
  />
);

/* I/J: the headline stays dead centre; best matchup flanks it on the left,
   toughest on the right. I puts two Targets in a centred row under it; J
   stacks one Target under each matchup so the two sides mirror. */
const spotPicks = (slate) => {
  const gameOf = (pick) => slate?.games.find((game) => game.gameId === pick.gameId);
  const { best, worst } = hooks.spotlight;
  return { best, worst, bestGame: gameOf(best), worstGame: gameOf(worst) };
};

const TargetsHead = ({ targets }) => (
  <div className="hp-flank-targets-head">
    <span className="hp-kicker">Your Targets tonight</span>
    {targets && (
      <ProtoLink to="/targets" className="hp-more">
        {targets.firing.length} of {targets.total} firing →
      </ProtoLink>
    )}
  </div>
);

const VariantI = (props) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-flank">
          <div className="hp-flank-side hp-flank-left">
            <SpotlightCard
              kind="Best matchup tonight"
              pick={best}
              game={bestGame}
              onUseQuery={props.onUseQuery}
            />
          </div>
          <div className="hp-flank-center">{props.hero}</div>
          <div className="hp-flank-side hp-flank-right">
            <SpotlightCard
              kind="Toughest matchup tonight"
              pick={worst}
              game={worstGame}
              onUseQuery={props.onUseQuery}
            />
          </div>
        </div>
      }
      middle={
        <section className="hp-flank-targets" aria-label="Your Targets tonight">
          <TargetsHead targets={targets} />
          <div className="hp-flank-targets-row">
            {targets ? (
              targets.firing
                .slice(0, 2)
                .map((entry) => <TargetCard key={entry.target.id} entry={entry} withMatchup />)
            ) : (
              <Loading />
            )}
          </div>
        </section>
      }
      ladder={<AnswerLadder onUseQuery={props.onUseQuery} />}
    />
  );
};

const VariantJ = (props) => {
  const { slate, targets } = props.data;
  const { best, worst, bestGame, worstGame } = spotPicks(slate);
  const [left, right] = targets ? targets.firing : [];
  return (
    <VariantE
      {...props}
      heroSlot={
        <div className="hp-flank hp-flank-j">
          <div className="hp-flank-side hp-flank-left">
            <SpotlightCard
              kind="Best matchup tonight"
              pick={best}
              game={bestGame}
              onUseQuery={props.onUseQuery}
            />
            {left && (
              <>
                <span className="hp-kicker hp-flank-kicker">Your Target firing</span>
                <TargetCard entry={left} withMatchup />
              </>
            )}
          </div>
          <div className="hp-flank-center">{props.hero}</div>
          <div className="hp-flank-side hp-flank-right">
            <SpotlightCard
              kind="Toughest matchup tonight"
              pick={worst}
              game={worstGame}
              onUseQuery={props.onUseQuery}
            />
            {right && (
              <>
                <span className="hp-kicker hp-flank-kicker">Your Target firing</span>
                <TargetCard entry={right} withMatchup />
              </>
            )}
          </div>
        </div>
      }
      ladder={<AnswerLadder onUseQuery={props.onUseQuery} />}
    />
  );
};

const VARIANTS = {
  I: VariantI,
  J: VariantJ,
  H: VariantH,
  F: VariantF,
  G: VariantG,
  E: VariantE,
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: VariantD,
};

const HomePreviewPrototype = ({ hero, ladder, variant, step, onUseQuery }) => {
  const data = useHomePreviewData();
  const Variant = VARIANTS[variant];
  return (
    <>
      <div className="landing-page hp-page">
        {Variant ? (
          <Variant hero={hero} ladder={ladder} data={data} onUseQuery={onUseQuery} />
        ) : (
          <div className="landing-container">
            {hero}
            {ladder}
          </div>
        )}
        {data.error && <p className="hp-loading">Prototype data failed: {data.error}</p>}
      </div>
      <PrototypeSwitcher variant={variant} onStep={step} />
    </>
  );
};

export default HomePreviewPrototype;
