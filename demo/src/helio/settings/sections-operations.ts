import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import {
  FormComponents,
  type FormSection,
} from "@antelopejs/interface-dms/base/form";
import { ticketAssigneeController } from "../service/assignees";
import { DEFAULT_TRAVEL_RADIUS_KM } from "./defaults";
import { WEEKDAYS, ZONE_SUGGESTIONS } from "./options";

const NAV_GROUP = "$helio.settings.groups.operations";
const HOUR_MS = 60 * 60 * 1000;
const MAX_SLA_HOURS = 240;
const RADIUS = { min: 10, max: 200, step: 10 };

function slaField(id: string, label: string) {
  return {
    id,
    label,
    type: new DefaultDataTypes.NumberType({
      min: 1,
      max: MAX_SLA_HOURS,
      suffix: "$helio.settings.units.hours",
    }),
    required: true,
  };
}

const hoursSection: FormSection = {
  id: "hours",
  label: "$helio.settings.sections.hours",
  description: "$helio.settings.sections.hours_description",
  icon: "i-ph-clock",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "workday",
      label: "$helio.settings.fields.workday",
      description: "$helio.settings.descriptions.workday",
      orientation: "horizontal",
      fields: [
        {
          id: "workdayStart",
          label: "$helio.settings.fields.workdayStart",
          type: new DefaultDataTypes.StringTimeType({
            min: 5 * HOUR_MS,
            max: 12 * HOUR_MS,
          }),
          required: true,
        },
        {
          id: "workdayEnd",
          label: "$helio.settings.fields.workdayEnd",
          type: new DefaultDataTypes.StringTimeType({
            min: 12 * HOUR_MS,
            max: 22 * HOUR_MS,
          }),
          required: true,
        },
      ],
    },
    {
      id: "workingDays",
      label: "$helio.settings.fields.workingDays",
      description: "$helio.settings.descriptions.workingDays",
      type: new DefaultDataTypes.SelectType({
        items: WEEKDAYS,
        multiple: true,
      }),
      required: true,
    },
    {
      id: "sla",
      label: "$helio.settings.fields.sla",
      description: "$helio.settings.descriptions.sla",
      orientation: "horizontal",
      fields: [
        slaField("slaUrgentHours", "$helio.settings.fields.slaUrgent"),
        slaField("slaHighHours", "$helio.settings.fields.slaHigh"),
        slaField("slaNormalHours", "$helio.settings.fields.slaNormal"),
        slaField("slaLowHours", "$helio.settings.fields.slaLow"),
      ],
    },
    {
      id: "winterClosure",
      label: "$helio.settings.fields.winterClosure",
      type: new DefaultDataTypes.DateType({ range: true }),
      hint: "$helio.settings.hints.winterClosure",
    },
    {
      id: "bridgeDays",
      label: "$helio.settings.fields.bridgeDays",
      description: "$helio.settings.descriptions.bridgeDays",
      type: new DefaultDataTypes.DateType({ multiple: true }),
    },
  ],
};

/**
 * The fieldwork fields. The default technician is picked among the people a
 * ticket can go to, as in the desk's Assignee picker.
 */
const fieldworkSection: FormSection = {
  id: "fieldwork",
  label: "$helio.settings.sections.fieldwork",
  description: "$helio.settings.sections.fieldwork_description",
  icon: "i-ph-truck",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "defaultTechnician",
      label: "$helio.settings.fields.defaultTechnician",
      description: "$helio.settings.descriptions.defaultTechnician",
      type: new DefaultDataTypes.RelationType({
        dataApiController: ticketAssigneeController,
        keyMapping: { label: "name", value: "_id", avatar: "avatar" },
        deselectable: true,
      }),
    },
    {
      id: "interventionZones",
      label: "$helio.settings.fields.interventionZones",
      type: new DefaultDataTypes.TagsType({
        suggestions: ZONE_SUGGESTIONS,
        max: 12,
        placeholder: "$helio.settings.placeholders.zone",
      }),
      hint: "$helio.settings.hints.interventionZones",
    },
    {
      id: "travelRadiusKm",
      label: "$helio.settings.fields.travelRadiusKm",
      type: new DefaultDataTypes.NumberType({
        ...RADIUS,
        suffix: "$helio.settings.units.km",
      }),
      inputComponent: FormComponents.InputSlider(RADIUS),
      defaultValue: DEFAULT_TRAVEL_RADIUS_KM,
      hint: "$helio.settings.hints.travelRadiusKm",
    },
  ],
};

/** The Operations part of the settings form: hours, then field work. */
export const operationsSections: FormSection[] = [
  hoursSection,
  fieldworkSection,
];
