import dayjs from "dayjs";

type AttendanceRow = {
  day: string;
  checkin_at: string | null;
};

export default function AttendanceHeatmap({
  rows,
}: {
  rows: AttendanceRow[];
}) {
  const map = new Map(rows.map(r => [r.day, r]));

  const days = Array.from({ length: 365 }).map((_, i) =>
    dayjs().subtract(364 - i, "day")
  );

  return (
    <div>
      <div className="grid grid-rows-7 grid-flow-col gap-1">
        {days.map(d => {
          const key = d.format("YYYY-MM-DD");
          const record = map.get(key);

          let color = "bg-muted";
          let title = "Absent";

          if (record?.checkin_at) {
            color = "bg-primary";
            title = "Present";
          }

          return (
            <div
              key={key}
              title={`${key} - ${title}`}
              className={`h-3 w-3 rounded-sm ${color}`}
            />
          );
        })}
      </div>

      <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
        <span>⬜ Absent</span>
        <span className="text-primary">⬛ Present</span>
      </div>
    </div>
  );
}
