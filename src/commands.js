const { SlashCommandBuilder } = require("discord.js");

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("profil")
      .setDescription("Arata activitatea unui politist.")
      .addUserOption((option) =>
        option.setName("user").setDescription("Politistul verificat.").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("pagina")
          .setDescription("Pagina de rapoarte.")
          .setMinValue(1)
          .setRequired(false)
      ),

    new SlashCommandBuilder().setName("statistici").setDescription("Arata statisticile generale."),

    new SlashCommandBuilder()
      .setName("top")
      .setDescription("Arata topul politistilor.")
      .addStringOption((option) =>
        option
          .setName("tip")
          .setDescription("Tipul topului.")
          .setRequired(false)
          .addChoices(
            { name: "Rapoarte", value: "reports" },
            { name: "Amenzi", value: "fines" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("perioada")
          .setDescription("Perioada calculata.")
          .setRequired(false)
          .addChoices(
            { name: "Total", value: "all" },
            { name: "Luna", value: "month" },
            { name: "Saptamana", value: "week" }
          )
      ),

    new SlashCommandBuilder()
      .setName("baza")
      .setDescription("Arata rapoartele din baza de date.")
      .addUserOption((option) =>
        option.setName("user").setDescription("Filtreaza dupa politist.").setRequired(false)
      )
      .addIntegerOption((option) =>
        option.setName("pagina").setDescription("Pagina.").setMinValue(1).setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("include_sterse")
          .setDescription("Include rapoartele sterse.")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("editare")
      .setDescription("Modifica sau sterge rapoarte. Doar staff.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("modifica")
          .setDescription("Modifica un camp dintr-un raport.")
          .addIntegerOption((option) =>
            option.setName("raport_id").setDescription("ID-ul raportului.").setMinValue(1).setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("camp")
              .setDescription("Campul modificat.")
              .setRequired(true)
              .addChoices(
                { name: "Nume", value: "agent_name" },
                { name: "CNP Agent", value: "cnp" },
                { name: "Functie detinuta", value: "functie" },
                { name: "Data", value: "report_date" },
                { name: "Ora", value: "report_time" },
                { name: "Infractiune + Amenda", value: "infraction" },
                { name: "Doar amenda", value: "fine_amount" },
                { name: "Poza cu buletin", value: "id_card_image_url" }
              )
          )
          .addStringOption((option) =>
            option.setName("valoare").setDescription("Noua valoare.").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("sterge")
          .setDescription("Sterge un raport.")
          .addIntegerOption((option) =>
            option.setName("raport_id").setDescription("ID-ul raportului.").setMinValue(1).setRequired(true)
          )
          .addStringOption((option) =>
            option.setName("motiv").setDescription("Motivul stergerii.").setRequired(false)
          )
      )
  ].map((command) => command.toJSON());
}

module.exports = buildCommands;
