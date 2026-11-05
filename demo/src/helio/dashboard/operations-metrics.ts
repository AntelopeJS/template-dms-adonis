import { GetModel } from "@antelopejs/interface-database-decorators";
import { type Project, ProjectModel } from "../projects/database";
import { PROJECT_TYPES } from "../projects/project-controller";
import { TicketModel } from "../service/database";
import { monthLabel, type ReaderLanguage, weekdayLabel } from "./locale";
import {
  deltaPercent,
  type Period,
  slices,
  type TimeRange,
  toTime,
  within,
} from "./period";
import type {
  ChartCardPayload,
  ChartSeriesPayload,
  KpiPayload,
} from "./sales-metrics";

/**
 * One column per calendar month the period touches, each clipped to the
 * period: the first and last columns count only the days inside it, so the
 * columns add up to the card's figure (installations over the period).
 */
function monthsCovering(range: TimeRange): TimeRange[] {
  const cursor = new Date(range.from);
  cursor.setFullYear(cursor.getFullYear(), cursor.getMonth(), 1);
  cursor.setHours(0, 0, 0, 0);
  const months: TimeRange[] = [];
  while (cursor.getTime() <= range.to) {
    const from = Math.max(cursor.getTime(), range.from);
    cursor.setMonth(cursor.getMonth() + 1);
    months.push({ from, to: Math.min(cursor.getTime() - 1, range.to) });
  }
  return months;
}

/** The projects that are not paused: a paused project has no date to stand on. */
function scheduled(projects: readonly Project[]): Project[] {
  return projects.filter((project) => project.status !== "on_hold");
}

function countIn(projects: readonly Project[], range: TimeRange): number {
  return projects.filter((project) => within(project.plannedStart, range))
    .length;
}

/** Installations started over the period, per month and stacked by type. */
export async function installations(
  period: Period,
  language: ReaderLanguage,
): Promise<ChartCardPayload> {
  const projects = scheduled(await GetModel(ProjectModel).getAll());
  const months = monthsCovering(period.range);
  const series: ChartSeriesPayload[] = PROJECT_TYPES.map((type) => {
    const ofType = projects.filter((project) => project.type === type.value);
    return {
      name: type.label,
      color: type.textColor,
      data: months.map((month) => ({
        x: monthLabel(month.from, language),
        y: countIn(ofType, month),
      })),
    };
  });
  const value = countIn(projects, period.range);
  const previous = period.compare
    ? countIn(projects, period.compare)
    : undefined;
  return {
    value,
    previousValue: previous,
    delta: deltaPercent(value, previous),
    series,
  };
}

/**
 * Service requests opened over the period. Counted at their opening rather
 * than as a backlog at a date: the seeds resolve historic tickets within days
 * and keep this month's open, so a backlog compared with last quarter would
 * read as a forty-fold rise.
 */
export async function newTicketsKpi(period: Period): Promise<KpiPayload> {
  const tickets = await GetModel(TicketModel).getAll();
  const opened = (range: TimeRange) =>
    tickets.filter((ticket) => within(ticket.createdAt, range)).length;
  const value = opened(period.range);
  const previous = period.compare ? opened(period.compare) : undefined;
  return {
    value,
    previousValue: previous,
    delta: deltaPercent(value, previous),
    sparkline: slices(period.range).map(opened),
  };
}

/** Weekday indexes (Date.getDay()) from Monday to Sunday, as a Belgian week reads. */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
const HOURS_PER_CELL = 2;
const CELLS_PER_DAY = 24 / HOURS_PER_CELL;

/**
 * Tickets opened in the period, by two-hour slot (rows) and weekday
 * (columns). Rows are named by their first hour as a bare number: inside a
 * chart card, the value formatter also writes the heatmap's row names, so a
 * name it cannot read as a number shows "NaN". The heatmap draws its first
 * series at the bottom, so the slots go from evening up to midnight on top.
 */
export async function ticketHeatmap(
  period: Period,
  language: ReaderLanguage,
): Promise<ChartCardPayload> {
  const tickets = (await GetModel(TicketModel).getAll()).filter((ticket) =>
    within(ticket.createdAt, period.range),
  );
  const grid = new Map<string, number>();
  for (const ticket of tickets) {
    const created = new Date(toTime(ticket.createdAt));
    const cell = Math.floor(created.getHours() / HOURS_PER_CELL);
    const key = `${created.getDay()}:${cell}`;
    grid.set(key, (grid.get(key) ?? 0) + 1);
  }
  const cells = Array.from({ length: CELLS_PER_DAY }, (_, cell) => cell);
  const series = cells.reverse().map((cell) => ({
    name: String(cell * HOURS_PER_CELL),
    data: WEEK.map((day) => ({
      x: weekdayLabel(day, language),
      y: grid.get(`${day}:${cell}`) ?? 0,
    })),
  }));
  return { value: tickets.length, delta: null, series };
}
