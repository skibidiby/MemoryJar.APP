import { Model } from "@nozbe/watermelondb";
import { field, text } from "@nozbe/watermelondb/decorators";

export default class Memory extends Model {
	static table = "memories";
	@field("cover_url") coverUrl!: string;
	@text("content") content!: string;
	@field("is_public") isPublic!: boolean;
	@field("user_id") userId!: string;
}
