import type { TriggerType } from "@antelopejs/interface-dms-automation";
import {
  listen,
  type QuoteAcceptedEvent,
  type TicketOpenedEvent,
} from "./events";

export const HELIO_TRIGGERS = {
  ticketOpened: "helio.ticket-opened",
  quoteAccepted: "helio.quote-accepted",
} as const;

interface TicketOpenedConfig {
  priority?: string;
}

/** The handle an armed trigger hands back, so `deactivate()` can recognise its own. */
class Subscription {
  constructor(readonly stop: () => void) {}
}

function stopListening(handle: Subscription | undefined): Promise<void> {
  handle?.stop();
  return Promise.resolve();
}

/**
 * Starts a procedure when a ticket is opened. The optional priority filter
 * lives on the trigger rather than in an If node, so a procedure about urgent
 * tickets starts no run at all for the others.
 */
const ticketOpened: TriggerType<TicketOpenedConfig, TicketOpenedEvent> = {
  id: HELIO_TRIGGERS.ticketOpened,
  name: "$helio.platform.automation.triggers.ticketOpened.name",
  description: "$helio.platform.automation.triggers.ticketOpened.description",
  icon: "i-ph-lifebuoy",
  cluster: "replicated",
  configSchema: {
    type: "object",
    properties: {
      priority: {
        type: "string",
        title: "$helio.platform.automation.triggers.ticketOpened.priority",
        enum: ["", "low", "normal", "high", "urgent"],
        default: "",
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      ticketId: {
        type: "string",
        title: "$helio.platform.automation.fields.ticketId",
      },
      number: {
        type: "string",
        title: "$helio.platform.automation.fields.number",
      },
      subject: {
        type: "string",
        title: "$helio.platform.automation.fields.subject",
      },
      priority: {
        type: "string",
        title: "$helio.platform.automation.fields.priority",
      },
      category: {
        type: "string",
        title: "$helio.platform.automation.fields.category",
      },
      channel: {
        type: "string",
        title: "$helio.platform.automation.fields.channel",
      },
      customerId: {
        type: "string",
        title: "$helio.platform.automation.fields.customerId",
      },
      at: {
        type: "string",
        title: "$helio.platform.automation.fields.at",
        format: "date-time",
      },
    },
  },
  activate(config, emit) {
    const priority = config?.priority ?? "";
    const stop = listen("ticket-opened", (event) => {
      if (!priority || event.priority === priority) emit(event);
    });
    return Promise.resolve(new Subscription(stop));
  },
  deactivate: (handle) =>
    stopListening(handle instanceof Subscription ? handle : undefined),
};

/** Starts a procedure when a customer signs a quote. */
const quoteAccepted: TriggerType<Record<string, never>, QuoteAcceptedEvent> = {
  id: HELIO_TRIGGERS.quoteAccepted,
  name: "$helio.platform.automation.triggers.quoteAccepted.name",
  description: "$helio.platform.automation.triggers.quoteAccepted.description",
  icon: "i-ph-seal-check",
  cluster: "replicated",
  configSchema: { type: "object", properties: {}, additionalProperties: false },
  outputSchema: {
    type: "object",
    properties: {
      quoteId: {
        type: "string",
        title: "$helio.platform.automation.fields.quoteId",
      },
      number: {
        type: "string",
        title: "$helio.platform.automation.fields.number",
      },
      customerId: {
        type: "string",
        title: "$helio.platform.automation.fields.customerId",
      },
      dealId: {
        type: "string",
        title: "$helio.platform.automation.fields.dealId",
      },
      total: {
        type: "number",
        title: "$helio.platform.automation.fields.total",
      },
      at: {
        type: "string",
        title: "$helio.platform.automation.fields.at",
        format: "date-time",
      },
    },
  },
  activate(_config, emit) {
    return Promise.resolve(new Subscription(listen("quote-accepted", emit)));
  },
  deactivate: (handle) =>
    stopListening(handle instanceof Subscription ? handle : undefined),
};

/**
 * Registered in construct(); the module unregisters them when it unloads.
 * Both triggers are in-process events fired by the domain actions, so every
 * instance arms them (`cluster: "replicated"`) and the instance that handled
 * the request is the one that fires.
 */
export const helioTriggerTypes = [ticketOpened, quoteAccepted];
