import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";

/**
 * The picture for the trade-offs: what each side of a fork looks like, and
 * the seed bank's sacks. Every group is drawn only once its choice is made
 * (or its sacks are in the bank), so the picture changes when you choose.
 * Motion lives in `gt-` classes in globals.css and stops for reduced motion.
 */

/** Yard: bees (a flower border and butterflies) or bug spray (a sprayer and mist). */
export function YardForkArt({ info }: { info: GrowSceneInfo }) {
  if (info.fork === 1)
    return (
      <g data-fork-art="bees" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i}>
            <rect x={34 + i * 28} y={150} width="2" height="7" fill="#3f9d3a" />
            <rect
              x={31 + i * 28}
              y={146}
              width="8"
              height="5"
              fill={["#f783ac", "#ffd43b", "#b197fc", "#ff8787"][i % 4]}
            />
          </g>
        ))}
        <g className="gt-flutter">
          <rect x="120" y="104" width="4" height="3" fill="#ffd43b" />
          <rect x="116" y="102" width="4" height="3" fill="#f59f00" />
          <rect x="124" y="102" width="4" height="3" fill="#f59f00" />
        </g>
        <g className="gt-flutter-b">
          <rect x="268" y="96" width="4" height="3" fill="#74c0fc" />
          <rect x="264" y="94" width="4" height="3" fill="#4dabf7" />
          <rect x="272" y="94" width="4" height="3" fill="#4dabf7" />
        </g>
      </g>
    );
  if (info.fork === 2)
    return (
      <g data-fork-art="spray" aria-hidden="true">
        {/* A little sprayer on wheels, and a drifting cloud of mist. */}
        <rect x="196" y="238" width="18" height="16" fill="#e03131" />
        <rect x="198" y="234" width="14" height="5" fill="#868e96" />
        <rect x="214" y="242" width="14" height="3" fill="#495057" />
        <rect x="193" y="253" width="8" height="5" fill="#212529" />
        <rect x="209" y="253" width="8" height="5" fill="#212529" />
        <g className="gt-mist" fill="#d0ebff" fillOpacity="0.75">
          <rect x="230" y="232" width="10" height="6" />
          <rect x="238" y="226" width="12" height="7" />
          <rect x="248" y="232" width="9" height="5" />
          <rect x="242" y="236" width="10" height="5" />
        </g>
        <g className="gt-mist-b" fill="#d0ebff" fillOpacity="0.6">
          <rect x="262" y="222" width="10" height="6" />
          <rect x="270" y="217" width="12" height="7" />
        </g>
        {/* A tidy sign for the bees that are not coming. */}
        <rect x="342" y="236" width="2" height="22" fill="#6b4423" />
        <rect x="330" y="230" width="26" height="12" fill="#fff3bf" />
        <rect x="334" y="234" width="18" height="2" fill="#c92a2a" />
      </g>
    );
  return null;
}

/** Farm: the scarecrow crew or the hawk. */
export function FarmForkArt({ info }: { info: GrowSceneInfo }) {
  return (
    <g aria-hidden="true">
      {info.fork === 1 && (
        <g data-fork-art="crew">
          {[0, 1, 2, 3].map((i) => (
            <g key={i} className={i % 2 ? "gt-crew-b" : "gt-crew"}>
              <rect
                x={30 + i * 90}
                y={138}
                width="2"
                height="14"
                fill="#6b4423"
              />
              <rect
                x={25 + i * 90}
                y={142}
                width="12"
                height="2"
                fill="#6b4423"
              />
              <rect
                x={27 + i * 90}
                y={132}
                width="8"
                height="7"
                fill="#e8c27a"
              />
              <rect
                x={26 + i * 90}
                y={130}
                width="10"
                height="3"
                fill="#8b5a2b"
              />
            </g>
          ))}
          <rect x="206" y="84" width="46" height="8" fill="#ffd43b" />
          <rect x="206" y="84" width="46" height="2" fill="#f59f00" />
        </g>
      )}
      {info.fork === 2 && (
        <g data-fork-art="hawk">
          <rect x="268" y="120" width="3" height="30" fill="#6b4423" />
          <rect x="262" y="118" width="15" height="3" fill="#6b4423" />
          <rect x="266" y="108" width="9" height="9" fill="#7b4a1e" />
          <rect x="274" y="110" width="4" height="3" fill="#ffd43b" />
          <g className="gt-circle">
            <rect x="120" y="50" width="14" height="3" fill="#5c3b1c" />
            <rect x="124" y="47" width="6" height="3" fill="#5c3b1c" />
            <rect x="126" y="53" width="3" height="3" fill="#5c3b1c" />
          </g>
          {/* The fair tent is shut for the hawk. */}
          <rect x="204" y="96" width="62" height="3" fill="#c92a2a" />
          <rect x="226" y="86" width="2" height="12" fill="#c92a2a" />
        </g>
      )}
    </g>
  );
}

/** World: old forest (tall trees) or wetland (ponds, reeds and a heron). */
export function WorldForkArt({ info }: { info: GrowSceneInfo }) {
  if (info.fork === 1)
    return (
      <g data-fork-art="forest" aria-hidden="true">
        {[138, 160, 182, 204, 226, 248].map((x, i) => (
          <g key={x} className={i % 2 ? "gt-canopy-b" : "gt-canopy"}>
            <rect
              x={x + 3}
              y={98 + (i % 3) * 6}
              width="3"
              height="14"
              fill="#5c3b1c"
            />
            <rect
              x={x - 2}
              y={84 + (i % 3) * 6}
              width="13"
              height="8"
              fill="#1b5e20"
            />
            <rect
              x={x}
              y={76 + (i % 3) * 6}
              width="9"
              height="8"
              fill="#2e7d32"
            />
            <rect
              x={x + 2}
              y={70 + (i % 3) * 6}
              width="5"
              height="6"
              fill="#43a047"
            />
          </g>
        ))}
      </g>
    );
  if (info.fork === 2)
    return (
      <g data-fork-art="wetland" aria-hidden="true">
        <rect
          x="132"
          y="200"
          width="70"
          height="14"
          fill="#4dabf7"
          fillOpacity="0.8"
        />
        <rect
          x="214"
          y="190"
          width="46"
          height="12"
          fill="#339af0"
          fillOpacity="0.8"
        />
        <g className="gt-ripple-w">
          <rect x="146" y="205" width="22" height="2" fill="#d0ebff" />
          <rect x="226" y="194" width="14" height="2" fill="#d0ebff" />
        </g>
        {[138, 150, 222, 240].map((x, i) => (
          <g key={x} className={i % 2 ? "gt-reed-b" : "gt-reed"}>
            <rect x={x} y={186} width="2" height="16" fill="#5f8d2d" />
            <rect x={x - 1} y={181} width="4" height="6" fill="#7b4a1e" />
          </g>
        ))}
        <g className="gt-heron">
          <rect x="176" y="178" width="3" height="22" fill="#adb5bd" />
          <rect x="172" y="176" width="9" height="5" fill="#dee2e6" />
          <rect x="181" y="176" width="7" height="2" fill="#f59f00" />
        </g>
      </g>
    );
  return null;
}

/** Seed: a sunbeam on the sill (morning sun) or a night-light with moths. */
export function SeedForkArt({ info }: { info: GrowSceneInfo }) {
  if (info.fork === 1)
    return (
      <g data-fork-art="sun" aria-hidden="true">
        <g className="gt-beam">
          <path
            d="M120 30 L168 30 L238 186 L150 186 Z"
            fill="#fff3bf"
            fillOpacity="0.28"
          />
          <path
            d="M150 30 L176 30 L214 186 L180 186 Z"
            fill="#ffe066"
            fillOpacity="0.22"
          />
        </g>
        <rect x="112" y="24" width="14" height="14" fill="#ffd43b" />
        <rect x="116" y="20" width="6" height="4" fill="#ffd43b" />
      </g>
    );
  if (info.fork === 2)
    return (
      <g data-fork-art="night-light" aria-hidden="true">
        <g className="gt-halo">
          <rect
            x="296"
            y="150"
            width="34"
            height="34"
            fill="#ffe066"
            fillOpacity="0.2"
          />
          <rect
            x="302"
            y="156"
            width="22"
            height="22"
            fill="#ffe066"
            fillOpacity="0.28"
          />
        </g>
        <rect x="306" y="168" width="14" height="16" fill="#ffd43b" />
        <rect x="304" y="184" width="18" height="4" fill="#495057" />
        <g className="gt-moth">
          <rect x="296" y="150" width="3" height="2" fill="#f1f3f5" />
          <rect x="299" y="148" width="3" height="2" fill="#f1f3f5" />
        </g>
        <g className="gt-moth-b">
          <rect x="326" y="160" width="3" height="2" fill="#dee2e6" />
          <rect x="329" y="158" width="3" height="2" fill="#dee2e6" />
        </g>
      </g>
    );
  return null;
}

/** Farm: drip lines, a leaf-mould heap and hybrid seed; bunting while a festival is on. */
export function FarmProjectArt({ info }: { info: GrowSceneInfo }) {
  return (
    <g aria-hidden="true">
      {(info.projects & 1) !== 0 && (
        <g data-project="drip-lines">
          {[0, 1].map((row) => (
            <g key={row}>
              <rect
                x="20"
                y={row ? 192 : 147}
                width="350"
                height="2"
                fill="#74c0fc"
              />
              {Array.from({ length: 8 }, (_, i) => (
                <rect
                  key={i}
                  x={36 + i * 44}
                  y={(row ? 194 : 149) + 1}
                  width="2"
                  height="3"
                  fill="#a5d8ff"
                  className="gt-drip"
                />
              ))}
            </g>
          ))}
        </g>
      )}
      {(info.projects & 2) !== 0 && (
        <g data-project="compost-heap">
          <rect x="62" y="266" width="44" height="14" fill="#4a2f18" />
          <rect x="68" y="258" width="32" height="10" fill="#5e3d20" />
          <rect x="76" y="252" width="16" height="8" fill="#6f4a28" />
          <rect x="72" y="262" width="6" height="3" fill="#74b816" />
          <rect x="90" y="260" width="6" height="3" fill="#c27c1a" />
          <circle
            cx="84"
            cy="248"
            r="2.5"
            fill="#ffffff"
            fillOpacity="0.7"
            className="lm-puff"
          />
        </g>
      )}
      {(info.projects & 4) !== 0 && (
        <g data-project="hybrid-seed" className="gt-sparkle">
          <rect x="340" y="132" width="3" height="3" fill="#ffd43b" />
          <rect x="360" y="124" width="3" height="3" fill="#fff3bf" />
          <rect x="352" y="140" width="3" height="3" fill="#ffd43b" />
          <rect x="332" y="146" width="3" height="3" fill="#fff3bf" />
          <rect x="368" y="144" width="3" height="3" fill="#ffd43b" />
        </g>
      )}
      <Bunting on={info.festival} />
    </g>
  );
}

/** World: rain gauges, a tree nursery and wildlife corridors; bunting for a green day. */
export function WorldProjectArt({ info }: { info: GrowSceneInfo }) {
  return (
    <g aria-hidden="true">
      {(info.projects & 1) !== 0 && (
        <g data-project="rain-gauges">
          {[112, 236, 288].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y={150 + i * 12}
                width="6"
                height="10"
                fill="#dee2e6"
              />
              <rect
                x={x + 1}
                y={154 + i * 12}
                width="4"
                height="6"
                fill="#4dabf7"
              />
            </g>
          ))}
        </g>
      )}
      {(info.projects & 2) !== 0 && (
        <g data-project="tree-nursery">
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i}>
              <rect
                x={246 + i * 8}
                y={228}
                width="2"
                height="6"
                fill="#5c3b1c"
              />
              <rect
                x={244 + i * 8}
                y={224}
                width="6"
                height="5"
                fill="#69db7c"
              />
            </g>
          ))}
        </g>
      )}
      {(info.projects & 4) !== 0 && (
        <g data-project="wildlife-corridors">
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={118 + i * 14}
              y={172 + Math.round(Math.sin(i / 1.6) * 8)}
              width="6"
              height="3"
              fill="#b2f2bb"
            />
          ))}
          <g className="gt-deer">
            <rect x="176" y="164" width="9" height="5" fill="#a9763f" />
            <rect x="183" y="160" width="4" height="5" fill="#a9763f" />
            <rect x="176" y="169" width="2" height="5" fill="#7b4a1e" />
            <rect x="182" y="169" width="2" height="5" fill="#7b4a1e" />
          </g>
        </g>
      )}
      <Bunting on={info.festival} />
    </g>
  );
}

/** A string of flags across the top of the picture while a festival is on. */
function Bunting({ on }: { on: boolean }) {
  if (!on) return null;
  const colors = ["#ff6b6b", "#ffd43b", "#69db7c", "#4dabf7", "#da77f2"];
  return (
    <g data-festival="on" className="gt-bunting">
      <rect x="10" y="22" width="380" height="2" fill="#495057" />
      {Array.from({ length: 19 }, (_, i) => (
        <rect
          key={i}
          x={16 + i * 20}
          y={24}
          width="9"
          height="9"
          fill={colors[i % colors.length]}
        />
      ))}
    </g>
  );
}
