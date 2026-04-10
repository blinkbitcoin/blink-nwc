import * as path from "node:path"

import { Knex } from "knex"

import { databaseEnv } from "./database-env"

export const databaseConfig = {
  host: databaseEnv.DB_HOST,
  port: databaseEnv.DB_PORT,
  user: databaseEnv.DB_USER,
  password: databaseEnv.DB_PWD,
  database: databaseEnv.DB_DB,
  poolMin: databaseEnv.DB_POOL_MIN,
  poolMax: databaseEnv.DB_POOL_MAX,
  debug: databaseEnv.DB_DEBUG,
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
    directory: path.resolve(__dirname, "./database/migrations"),
  },
  seeds: {
    directory: path.resolve(__dirname, "./database/seeds"),
  },
}

export default config
