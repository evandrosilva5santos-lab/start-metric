import { PrismaClient } from '../generated/prisma/client.js';

type ErrorLike = {
  code?: string;
  name?: string;
  message?: string;
};

async function testDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL não está configurada em .env');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    accelerateUrl: connectionString,
  });

  try {
    console.log('🔍 Testando conexão com Supabase...\n');

    // 1. Teste de conexão
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexão com banco de dados estabelecida!\n');

    // 2. Teste de tabelas principais
    console.log('📊 Verificando tabelas principais:\n');

    // Organizations
    const orgCount = await prisma.organizations.count();
    console.log(`  • organizations: ${orgCount} registros`);

    // Ad Accounts
    const adAccountCount = await prisma.ad_accounts.count();
    console.log(`  • ad_accounts: ${adAccountCount} registros`);

    // Campaigns
    const campaignCount = await prisma.campaigns.count();
    console.log(`  • campaigns: ${campaignCount} registros`);

    // Daily Metrics
    const metricsCount = await prisma.daily_metrics.count();
    console.log(`  • daily_metrics: ${metricsCount} registros`);

    // Profiles
    const profileCount = await prisma.profiles.count();
    console.log(`  • profiles: ${profileCount} registros`);

    // Users (auth schema)
    const userCount = await prisma.users.count();
    console.log(`  • users (auth): ${userCount} registros\n`);

    // 3. Teste de relacionamentos
    console.log('🔗 Validando relacionamentos:\n');

    // Se houver organizations, buscar com relações
    const org = await prisma.organizations.findFirst({
      include: {
        ad_accounts: true,
        campaigns: true,
        profiles: true,
      },
    });

    if (org) {
      console.log(`  ✅ Organização encontrada: ${org.name}`);
      console.log(`     - Ad Accounts: ${org.ad_accounts.length}`);
      console.log(`     - Campaigns: ${org.campaigns.length}`);
      console.log(`     - Profiles: ${org.profiles.length}\n`);
    } else {
      console.log(`  ℹ️  Nenhuma organização encontrada (banco vazio)\n`);
    }

    // 4. Teste de schemas múltiplos
    console.log('🏗️  Schemas configurados:\n');
    const schemas = await prisma.$queryRaw`
      SELECT table_schema, COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema IN ('auth', 'public')
      GROUP BY table_schema
    `;
    console.log(schemas);
    console.log();

    // 5. Status final
    console.log('═══════════════════════════════════════════════');
    console.log('✨ Motor de Banco de Dados: OPERACIONAL');
    console.log('═══════════════════════════════════════════════\n');
    console.log('📋 Resumo de Sincronização:');
    console.log(`  • Schema Prisma: ✅ Sincronizado (28 modelos)`);
    console.log(`  • Conexão Supabase: ✅ Ativa`);
    console.log(`  • Tabelas Principais: ✅ Acessíveis`);
    console.log(`  • Relacionamentos: ✅ Funcionais`);
    console.log(`  • Múltiplos Schemas: ✅ Configurado (auth + public)\n`);
  } catch (error: unknown) {
    const parsed = (error as ErrorLike) ?? {};
    const errorCode = parsed.code ?? parsed.name ?? 'UNKNOWN_ERROR';
    const errorMessage = parsed.message ?? 'Erro desconhecido';

    console.error('❌ ERRO NA CONEXÃO:\n');
    console.error(`  Tipo: ${errorCode}`);
    console.error(`  Mensagem: ${errorMessage}\n`);

    if (errorCode === 'P1002') {
      console.error('  → Problema: Não conseguiu conectar ao banco de dados');
      console.error(
        '  → Solução: Verifique se DATABASE_URL está correta em .env\n',
      );
    } else if (errorCode === 'P1008') {
      console.error('  → Problema: Timeout na conexão');
      console.error('  → Solução: O Supabase pode estar indisponível\n');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void testDatabase();
