import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import migrations from "../drizzle/migrations";

// SQLite.deleteDatabaseSync("db.db");

export const expoDb = SQLite.openDatabaseSync("db.db", { enableChangeListener: true });
export const db = drizzle(expoDb);
export { migrations };

