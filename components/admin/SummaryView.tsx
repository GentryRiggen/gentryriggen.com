import type { Summary } from "@/lib/analytics/aggregate";
import BreakdownList from "./BreakdownList";
import StatTile from "./StatTile";
import TimeSeriesChart from "./TimeSeriesChart";
import VisitorMap from "./VisitorMap";

interface SummaryViewProps {
  summary: Summary;
  /** False when the data was truncated: the previous period is incomplete. */
  comparable?: boolean;
}

export default function SummaryView({
  summary,
  comparable = true,
}: SummaryViewProps) {
  const { totals, previous, series, breakdowns, places } = summary;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Views"
          value={totals.views}
          previous={comparable ? previous.views : null}
          testId="stat-views"
        />
        <StatTile
          label="Daily visitors"
          value={totals.visitors}
          previous={comparable ? previous.visitors : null}
          testId="stat-visitors"
        />
      </div>
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <TimeSeriesChart series={series} />
      </div>
      <VisitorMap places={places} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownList title="Top pages" rows={breakdowns.paths} />
        <BreakdownList title="Referrers" rows={breakdowns.referrers} />
        <BreakdownList title="Devices" rows={breakdowns.devices} />
        <BreakdownList title="Browsers" rows={breakdowns.browsers} />
        <BreakdownList title="Operating systems" rows={breakdowns.systems} />
        <BreakdownList title="Screen widths" rows={breakdowns.screens} />
      </div>
    </div>
  );
}
