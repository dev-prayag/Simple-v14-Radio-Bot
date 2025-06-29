import { SlashCommandBuilder } from 'discord.js';

export const radioCommand = new SlashCommandBuilder()
  .setName('radio')
  .setDescription('Play a radio stream URL')
  .addStringOption(option =>
    option.setName('station').setDescription('Radio URL').setRequired(true)
  )
  .toJSON();
