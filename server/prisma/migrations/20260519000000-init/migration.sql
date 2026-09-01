-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('USER', 'AI');

-- CreateTable
CREATE TABLE "users" (
  "id" BIGSERIAL NOT NULL,
  "user_account" VARCHAR(256) NOT NULL,
  "user_password" VARCHAR(512) NOT NULL,
  "username" VARCHAR(256),
  "user_avatar" VARCHAR(1024),
  "user_profile" VARCHAR(512),
  "user_role" "UserRole" NOT NULL DEFAULT 'USER',
  "edit_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  "is_delete" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
  "id" BIGSERIAL NOT NULL,
  "app_name" VARCHAR(256),
  "app_cover" VARCHAR(512),
  "init_prompt" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "user_id" BIGINT NOT NULL,
  "edit_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  "is_delete" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_histories" (
  "id" BIGSERIAL NOT NULL,
  "message" TEXT NOT NULL,
  "message_type" "ChatMessageType" NOT NULL,
  "app_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  "is_delete" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "chat_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_user_account_key" ON "users"("user_account");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_apps_app_name" ON "apps"("app_name");

-- CreateIndex
CREATE INDEX "idx_apps_user_id" ON "apps"("user_id");

-- CreateIndex
CREATE INDEX "idx_apps_priority_create_time" ON "apps"("priority", "create_time");

-- CreateIndex
CREATE INDEX "idx_chat_histories_app_id" ON "chat_histories"("app_id");

-- CreateIndex
CREATE INDEX "idx_chat_histories_create_time" ON "chat_histories"("create_time");

-- CreateIndex
CREATE INDEX "idx_chat_histories_app_id_create_time" ON "chat_histories"("app_id", "create_time");

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_histories" ADD CONSTRAINT "chat_histories_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_histories" ADD CONSTRAINT "chat_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
