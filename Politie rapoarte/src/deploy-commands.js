require("dotenv").config();
const { REST, Routes } = require("discord.js");
const config = require("./config");
const buildCommands = require("./commands");

async function main() {
  if (!config.token) {
    throw new Error("Lipseste DISCORD_TOKEN in .env");
  }

  if (!config.clientId) {
    throw new Error("Lipseste DISCORD_CLIENT_ID in .env");
  }

  const rest = new REST({ version: "10" }).setToken(config.token);
  const commands = buildCommands();

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands
  });

  console.log(`Comenzi inregistrate pe serverul ${config.guildId}: ${commands.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
