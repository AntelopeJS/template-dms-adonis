import { Logging } from "@antelopejs/interface-core/logging";
import type { TicketPriority } from "../../service/database";
import { helioNow } from "../../shared/clock";

/** What a "Ticket opened" trigger hands its procedure. */
export type TicketOpenedEvent = {
  ticketId: string;
  number: string;
  subject: string;
  priority: TicketPriority;
  category: string;
  channel: string;
  customerId: string;
  at: string;
};

/** What a "Quote accepted" trigger hands its procedure. */
export type QuoteAcceptedEvent = {
  quoteId: string;
  number: string;
  customerId: string;
  dealId: string;
  total: number;
  at: string;
};

/**
 * The Helio business events procedures can start on, with their payloads. The
 * domains fire them (a ticket opened, a quote accepted); the trigger types of
 * `triggers.ts` hold one listener per armed procedure.
 */
interface HelioEvents {
  "ticket-opened": TicketOpenedEvent;
  "quote-accepted": QuoteAcceptedEvent;
}

type HelioEventName = keyof HelioEvents;
type Listener<E extends HelioEventName> = (payload: HelioEvents[E]) => void;

/** The listeners of each event. */
type ListenerSets = { [E in HelioEventName]: Set<Listener<E>> };

const listeners: ListenerSets = {
  "ticket-opened": new Set(),
  "quote-accepted": new Set(),
};

/** Adds a listener; the returned function removes it. */
export function listen<E extends HelioEventName>(
  event: E,
  listener: Listener<E>,
): () => void {
  const set: Set<Listener<E>> = listeners[event];
  set.add(listener);
  return () => set.delete(listener);
}

/**
 * Calls every listener of an event. It never fails the caller: a throwing
 * listener is logged, and without the automation module, or with no procedure
 * listening, nothing happens.
 */
function fire<E extends HelioEventName>(
  event: E,
  payload: HelioEvents[E],
): void {
  const set: Set<Listener<E>> = listeners[event];
  for (const listener of set) {
    try {
      listener(payload);
    } catch (error) {
      Logging.Warn(`[helio] automation event ${event}: ${String(error)}`);
    }
  }
}

/** A ticket was just created (form, simulator, monitoring alert). */
export function fireTicketOpened(ticket: {
  _id: string;
  number: string;
  subject: string;
  priority: TicketPriority;
  category: string;
  channel: string;
  customer: string;
}): void {
  fire("ticket-opened", {
    ticketId: ticket._id,
    number: ticket.number,
    subject: ticket.subject,
    priority: ticket.priority,
    category: ticket.category,
    channel: ticket.channel,
    customerId: ticket.customer,
    at: new Date(helioNow()).toISOString(),
  });
}

/** A sent quote was just signed by its customer. */
export function fireQuoteAccepted(quote: {
  _id: string;
  number: string;
  customer: string;
  deal?: string;
  total: number;
}): void {
  fire("quote-accepted", {
    quoteId: quote._id,
    number: quote.number,
    customerId: quote.customer,
    dealId: quote.deal ?? "",
    total: quote.total,
    at: new Date(helioNow()).toISOString(),
  });
}
