import nodemailer from 'nodemailer';
import { prisma } from '../config/db';

async function seedEtherealSender() {
  console.log('Generating Ethereal SMTP Test Account...');
  
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Generated Ethereal Credentials:');
    console.log(`User: ${testAccount.user}`);
    console.log(`Pass: ${testAccount.pass}`);
    console.log(`Host: ${testAccount.smtp.host}:${testAccount.smtp.port}`);

    const sender = await prisma.sender.upsert({
      where: { email: testAccount.user },
      update: {
        smtpHost: testAccount.smtp.host,
        smtpPort: 465,
        smtpUser: testAccount.user,
        smtpPass: testAccount.pass,
      },
      create: {
        name: 'Ethereal Primary Sender',
        email: testAccount.user,
        smtpHost: testAccount.smtp.host,
        smtpPort: 465,
        smtpUser: testAccount.user,
        smtpPass: testAccount.pass,
        maxEmailsPerHour: 200,
        minDelayBetweenSends: 2,
      },
    });

    console.log(`\nSuccessfully seeded Sender in Database!`);
    console.log(`Sender ID: ${sender.id}`);
    console.log(`Sender Email: ${sender.email}`);
  } catch (err) {
    console.error('Failed to seed Ethereal Sender:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedEtherealSender();
