const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ خطأ: متغير البيئة TOKEN غير موجود! أضفه في إعدادات Render.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('إرسال لوحة تحكم الإدارة التفاعلية إلى هذا الروم')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

const pendingActions = new Map();

client.once('ready', async () => {
  console.log(`✅ تم تسجيل الدخول كـ: ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ تم تسجيل أوامر السلاش (/panel) بنجاح.');
  } catch (err) {
    console.error('❌ فشل تسجيل أوامر السلاش:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ هذا الأمر متاح للأدمن فقط.',
          flags: MessageFlags.Ephemeral
        });
      }

      const panelEmbed = new EmbedBuilder()
        .setTitle('🛡️ لوحة إدارة السيرفر')
        .setColor('#2b2d31')
        .setDescription(
          'اختر العملية المطلوبة من الأزرار بالأسفل. العمليات الحساسة (الحذف والحظر) تتطلب **خطوة تأكيد** قبل التنفيذ.\n\n' +
          '• **➕ إضافة روم:** يفتح نافذة لإدخال اسم الروم وإنشائه.\n' +
          '• **🗑️ حذف روم:** يطلب منك ID أو اسم الروم ثم يطلب تأكيداً قبل الحذف.\n' +
          '• **🎭 إضافة رتبة:** يفتح نافذة لإدخال اسم الرتبة وإنشائها.\n' +
          '• **❌ إزالة رتبة:** يطلب منك ID أو اسم الرتبة ثم يطلب تأكيداً قبل الحذف.\n' +
          '• **🔨 حظر عضو:** يطلب منك ID العضو وسبب الحظر ثم يطلب تأكيداً قبل التنفيذ.'
        )
        .setFooter({ text: 'Admin Panel • Safe Execution Mode' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_add_channel')
          .setLabel('إضافة روم')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_del_channel')
          .setLabel('حذف روم')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('btn_add_role')
          .setLabel('إضافة رتبة')
          .setEmoji('🎭')
          .setStyle(ButtonStyle.Primary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_del_role')
          .setLabel('حذف رتبة')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_ban_member')
          .setLabel('حظر عضو')
          .setEmoji('🔨')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        embeds: [panelEmbed],
        components: [row1, row2]
      });
      return;
    }

    if (interaction.isButton()) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ ليس لديك صلاحية لاستخدام أزرار الإدارة.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'btn_add_channel') {
        const modal = new ModalBuilder()
          .setCustomId('modal_add_channel')
          .setTitle('إضافة روم نصي جديد');

        const nameInput = new TextInputBuilder()
          .setCustomId('channel_name')
          .setLabel('اسم الروم')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: general-chat')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_del_channel') {
        const modal = new ModalBuilder()
          .setCustomId('modal_del_channel')
          .setTitle('حذف روم (يتطلب تأكيداً)');

        const targetInput = new TextInputBuilder()
          .setCustomId('channel_target')
          .setLabel('أدخل ID الروم أو اسمه')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 123456789012345678')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_add_role') {
        const modal = new ModalBuilder()
          .setCustomId('modal_add_role')
          .setTitle('إضافة رتبة جديدة');

        const roleNameInput = new TextInputBuilder()
          .setCustomId('role_name')
          .setLabel('اسم الرتبة')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: VIP')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(roleNameInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_del_role') {
        const modal = new ModalBuilder()
          .setCustomId('modal_del_role')
          .setTitle('حذف رتبة (يتطلب تأكيداً)');

        const roleTargetInput = new TextInputBuilder()
          .setCustomId('role_target')
          .setLabel('أدخل ID الرتبة أو اسمها')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 123456789012345678 أو VIP')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(roleTargetInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_ban_member') {
        const modal = new ModalBuilder()
          .setCustomId('modal_ban_member')
          .setTitle('حظر عضو (يتطلب تأكيداً)');

        const userIdInput = new TextInputBuilder()
          .setCustomId('ban_user_id')
          .setLabel('أدخل ID العضو')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مثال: 123456789012345678')
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId('ban_reason')
          .setLabel('سبب الحظر (اختياري)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('مخالفة القوانين')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(userIdInput),
          new ActionRowBuilder().addComponents(reasonInput)
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'confirm_action') {
        const actionData = pendingActions.get(interaction.user.id);
        if (!actionData) {
          return interaction.reply({
            content: '⚠️ انتهت مهلة التأكيد أو لا توجد عملية معلّقة.',
            flags: MessageFlags.Ephemeral
          });
        }

        pendingActions.delete(interaction.user.id);

        if (actionData.type === 'delete_channel') {
          const channel = interaction.guild.channels.cache.get(actionData.channelId);
          if (!channel) {
            return interaction.update({ content: '❌ الروم غير موجود بالفعل.', components: [] });
          }
          const chName = channel.name;
          await channel.delete(`حذف بواسطة ${interaction.user.tag} عبر لوحة الإدارة`);
          return interaction.update({ content: `✅ تم حذف الروم **#${chName}** بنجاح.`, components: [] });
        }

        if (actionData.type === 'delete_role') {
          const role = interaction.guild.roles.cache.get(actionData.roleId);
          if (!role) {
            return interaction.update({ content: '❌ الرتبة غير موجودة بالفعل.', components: [] });
          }
          const rName = role.name;
          await role.delete(`حذف بواسطة ${interaction.user.tag} عبر لوحة الإدارة`);
          return interaction.update({ content: `✅ تم حذف الرتبة **${rName}** بنجاح.`, components: [] });
        }

        if (actionData.type === 'ban_member') {
          await interaction.guild.members.ban(actionData.userId, {
            reason: `${actionData.reason} | بواسطة ${interaction.user.tag}`
          });
          return interaction.update({
            content: `✅ تم حظر المستخدم صاحب ID: \`${actionData.userId}\` بنجاح.`,
            components: []
          });
        }
      }

      if (interaction.customId === 'cancel_action') {
        pendingActions.delete(interaction.user.id);
        return interaction.update({
          content: '🛑 تم إلغاء العملية بأمان ولم يتم تنفيذ أي تغيير.',
          components: []
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_add_channel') {
        const rawName = interaction.fields.getTextInputValue('channel_name').trim();
        const created = await interaction.guild.channels.create({
          name: rawName,
          type: ChannelType.GuildText
        });
        return interaction.reply({
          content: `✅ تم إنشاء الروم ${created} بنجاح.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'modal_del_channel') {
        const query = interaction.fields.getTextInputValue('channel_target').trim();
        const channel =
          interaction.guild.channels.cache.get(query) ||
          interaction.guild.channels.cache.find(c => c.name.toLowerCase() === query.toLowerCase());

        if (!channel) {
          return interaction.reply({
            content: '❌ لم يتم العثور على هذا الروم في السيرفر.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (channel.id === interaction.channelId) {
          return interaction.reply({
            content: '⚠️ لا يمكنك حذف الروم الحالي الذي تستخدم فيه اللوحة.',
            flags: MessageFlags.Ephemeral
          });
        }

        pendingActions.set(interaction.user.id, {
          type: 'delete_channel',
          channelId: channel.id
        });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_action')
            .setLabel('تأكيد الحذف')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: `⚠️ هل أنت متأكد من **حذف الروم** (${channel} / \`${channel.name}\`)؟`,
          components: [confirmRow],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'modal_add_role') {
        const roleName = interaction.fields.getTextInputValue('role_name').trim();
        const role = await interaction.guild.roles.create({ name: roleName });
        return interaction.reply({
          content: `✅ تم إنشاء الرتبة **${role.name}** بنجاح.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'modal_del_role') {
        const query = interaction.fields.getTextInputValue('role_target').trim();
        const role =
          interaction.guild.roles.cache.get(query) ||
          interaction.guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());

        if (!role) {
          return interaction.reply({
            content: '❌ لم يتم العثور على هذه الرتبة في السيرفر.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (role.id === interaction.guild.id || !role.editable) {
          return interaction.reply({
            content: '⚠️ لا يمكن حذف هذه الرتبة (إما رتبة @everyone أو أعلى من رتبة البوت).',
            flags: MessageFlags.Ephemeral
          });
        }

        pendingActions.set(interaction.user.id, {
          type: 'delete_role',
          roleId: role.id
        });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_action')
            .setLabel('تأكيد حذف الرتبة')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: `⚠️ هل أنت متأكد من **حذف الرتبة** (\`${role.name}\`)؟`,
          components: [confirmRow],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'modal_ban_member') {
        const userId = interaction.fields.getTextInputValue('ban_user_id').trim();
        const reason = interaction.fields.getTextInputValue('ban_reason').trim() || 'لم يُذكر سبب';

        if (userId === interaction.user.id || userId === client.user.id) {
          return interaction.reply({
            content: '⚠️ لا يمكنك حظر نفسك أو حظر البوت من هنا.',
            flags: MessageFlags.Ephemeral
          });
        }

        pendingActions.set(interaction.user.id, {
          type: 'ban_member',
          userId,
          reason
        });

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_action')
            .setLabel('تأكيد الحظر')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('إلغاء')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: `⚠️ هل أنت متأكد من **حظر المستخدم** صاحب ID: \`${userId}\`\n**السبب:** ${reason}`,
          components: [confirmRow],
          flags: MessageFlags.Ephemeral
        });
      }
    }
  } catch (error) {
    console.error('❌ حدث خطأ أثناء معالجة التفاعل:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ حدث خطأ أثناء تنفيذ العملية. تأكد من صلاحيات البوت وترتيب رتبته في السيرفر.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
