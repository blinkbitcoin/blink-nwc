import { Knex } from "knex"

export const databaseConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "", 10) || 5431,
  user: process.env.DB_USER || "blink-nwc-usr",
  password: process.env.DB_PWD || "blink-nwc-pwd",
  database: process.env.DB_DB || "blink-nwc",
  poolMin: parseInt(process.env.DB_POOL_MIN || "", 10) || 1,
  poolMax: parseInt(process.env.DB_POOL_MAX || "", 10) || 5,
  debug: process.env.DB_DEBUG === "true",
}

const { host, port, user, password, database, poolMin, poolMax, debug } = databaseConfig

const config: Knex.Config = {
  client: "pg",
  debug,
  connection: {
    host,
    port,
    user,
    password,
    database,
  },
  pool: {
    min: poolMin,
    max: poolMax,
  },
  migrations: {
    tableName: "knex_migrations",
    directory: "./database/migrations",
  },
  seeds: {
    directory: "./database/seeds",
  },
}

export default config
