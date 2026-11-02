import { INK, PixelText } from "./parts";

interface ForkArtProps {
  /** 0 the first side of the fork, 1 the second. */
  side: 0 | 1;
}

/** Jokes: a speech bubble over the step, with a joke on its way. */
function Jokes() {
  return (
    <g data-fork-art="jokes">
      <g className="ms-bob">
        <rect x="236" y="116" width="60" height="26" fill="#fff" />
        <rect x="240" y="142" width="8" height="6" fill="#fff" />
        <PixelText x={266} y={134} fill={INK}>
          HA HA!
        </PixelText>
      </g>
      <g className="ms-bob-b">
        <rect x="104" y="130" width="46" height="22" fill="#ffe29a" />
        <PixelText x={127} y={146} fill={INK}>
          HONK
        </PixelText>
      </g>
    </g>
  );
}

/** Kindness: a drawing, a flower and some hearts, made by hand. */
function Kindness() {
  return (
    <g data-fork-art="kindness">
      <g className="ms-sway">
        <rect x="262" y="176" width="3" height="16" fill="#3f9d3a" />
        <rect x="258" y="168" width="11" height="9" fill="#ff9eb0" />
        <rect x="261" y="171" width="5" height="3" fill="#ffd23f" />
      </g>
      <g fill="#ff5d73">
        <g className="ms-bob">
          <rect x="232" y="140" width="6" height="5" />
          <rect x="236" y="140" width="6" height="5" />
          <rect x="233" y="145" width="8" height="4" />
          <rect x="235" y="149" width="4" height="3" />
        </g>
        <g className="ms-bob-b">
          <rect x="250" y="124" width="5" height="4" />
          <rect x="253" y="124" width="5" height="4" />
          <rect x="251" y="128" width="6" height="3" />
        </g>
      </g>
    </g>
  );
}

export function FriendForkArt({ side }: ForkArtProps) {
  return side === 0 ? <Jokes /> : <Kindness />;
}

/** The clown school: a striped tent with a squirting flower. */
function ClownSchool() {
  return (
    <g data-fork-art="clown">
      <rect x="296" y="150" width="58" height="34" fill="#ff5d73" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={296 + i * 15}
          y="150"
          width="7"
          height="34"
          fill="#fff"
        />
      ))}
      <rect x="292" y="144" width="66" height="8" fill="#ffd23f" />
      <rect x="318" y="164" width="14" height="20" fill="#2b2140" />
      <g className="ms-bob">
        <rect x="334" y="136" width="8" height="8" fill="#ff5d73" />
        <rect x="336" y="144" width="4" height="4" fill="#ff5d73" />
      </g>
    </g>
  );
}

/** The smile factory: a long shed with a belt of grinning crates. */
function SmileFactory() {
  return (
    <g data-fork-art="factory">
      <rect x="290" y="156" width="68" height="30" fill="#8e9bb0" />
      <rect x="290" y="150" width="68" height="8" fill="#5b6b82" />
      <rect x="338" y="124" width="10" height="28" fill="#5b6b82" />
      <g className="ms-puff">
        <rect
          x="338"
          y="116"
          width="10"
          height="8"
          fill="#fff"
          fillOpacity="0.8"
        />
      </g>
      <g className="ms-march">
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={296 + i * 18}
              y="172"
              width="12"
              height="10"
              fill="#ffd23f"
            />
            <rect x={299 + i * 18} y="175" width="2" height="2" fill={INK} />
            <rect x={304 + i * 18} y="175" width="2" height="2" fill={INK} />
            <rect x={299 + i * 18} y="178" width="7" height="1" fill={INK} />
          </g>
        ))}
      </g>
    </g>
  );
}

export function TownForkArt({ side }: ForkArtProps) {
  return side === 0 ? <ClownSchool /> : <SmileFactory />;
}

/** Loudspeakers: a pole with a big horn and rings of cheerful noise. */
function Loudspeakers() {
  return (
    <g data-fork-art="loudspeakers">
      <rect x="40" y="96" width="4" height="60" fill="#5b6b82" />
      <rect x="30" y="86" width="24" height="14" fill="#ff5d73" />
      <rect x="22" y="82" width="8" height="22" fill="#ffd23f" />
      <g fill="none" stroke="#ffd23f" strokeWidth="2">
        <circle cx="14" cy="93" r="9" className="ms-ring" />
        <circle cx="14" cy="93" r="9" className="ms-ring-b" />
      </g>
    </g>
  );
}

/** Listening boxes: little boxes with notes poking out. */
function ListeningBoxes() {
  return (
    <g data-fork-art="boxes">
      <rect x="30" y="132" width="22" height="24" fill="#c98f55" />
      <rect x="34" y="138" width="14" height="3" fill="#2b2140" />
      <g className="ms-bob">
        <rect x="36" y="126" width="9" height="8" fill="#fff" />
        <rect x="40" y="122" width="9" height="8" fill="#fff59d" />
      </g>
      <rect x="58" y="142" width="16" height="14" fill="#c98f55" />
      <rect x="61" y="146" width="10" height="2" fill="#2b2140" />
    </g>
  );
}

export function WorldForkArt({ side }: ForkArtProps) {
  return side === 0 ? <Loudspeakers /> : <ListeningBoxes />;
}

/** A few words: a small bubble of quiet talk over the bench. */
function FewWords() {
  return (
    <g data-fork-art="words">
      <g className="ms-bob">
        <rect x="170" y="86" width="44" height="22" fill="#e8e2ff" />
        <rect x="174" y="108" width="8" height="6" fill="#e8e2ff" />
        <rect x="178" y="94" width="4" height="4" fill="#8a7fb8" />
        <rect x="188" y="94" width="4" height="4" fill="#8a7fb8" />
        <rect x="198" y="94" width="4" height="4" fill="#8a7fb8" />
      </g>
    </g>
  );
}

/** Just sit: a hush, drawn as a small moon over the bench. */
function JustSit() {
  return (
    <g data-fork-art="sit">
      <circle
        cx="196"
        cy="94"
        r="12"
        fill="#fff4cf"
        fillOpacity="0.2"
        className="ms-glow"
      />
      <circle cx="196" cy="94" r="8" fill="#fff4cf" />
      <circle cx="199" cy="92" r="7" fill="#1d2c58" />
    </g>
  );
}

export function QuietForkArt({ side }: ForkArtProps) {
  return side === 0 ? <FewWords /> : <JustSit />;
}
