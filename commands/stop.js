import { SlashCommandBuilder } from 'discord.js';

export const stopCommand = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop the radio stream')
  .toJSON();
