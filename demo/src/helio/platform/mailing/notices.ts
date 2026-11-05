import {
  BasicDataModel,
  Field,
  GetModel,
  Index,
  RegisterTable,
  Table,
} from "@antelopejs/interface-database-decorators";
import { DEMO_SCHEMA_NAME } from "../../../schema";

const TABLE_NAME = "helio_mail_notices";

/** `installation`: a project's date was confirmed to its customer. */
export type NoticeKind = "installation";

/**
 * Records which one-off e-mails a record already received, so a scheduled run
 * never writes twice about the same thing: the installation date of a project
 * is confirmed once, whether by the weekly run or by the imported history.
 */
@RegisterTable(TABLE_NAME, DEMO_SCHEMA_NAME)
export class MailNotice extends Table {
  /** `<kind>:<record id>`: one notice per record and kind. */
  @Field("string") declare _id: string;
  @Index() @Field("string") declare kind: NoticeKind;
  @Field("string") declare recordId: string;
  @Field("date") declare sentAt: Date;
}

export class MailNoticeModel extends BasicDataModel(MailNotice, TABLE_NAME) {}

const noticeId = (kind: NoticeKind, recordId: string) => `${kind}:${recordId}`;

/** The records of `kind` already written about. */
export async function noticedRecords(kind: NoticeKind): Promise<Set<string>> {
  const notices = await GetModel(MailNoticeModel).getBy("kind", kind);
  return new Set(notices.map(({ recordId }) => recordId));
}

/** Notes that `recordId` received its e-mail of `kind`; a second call is a no-op. */
export async function recordNotice(
  kind: NoticeKind,
  recordId: string,
  sentAt: Date,
): Promise<void> {
  const model = GetModel(MailNoticeModel);
  const _id = noticeId(kind, recordId);
  if (await model.get(_id)) return;
  await model.insert({ _id, kind, recordId, sentAt });
}
