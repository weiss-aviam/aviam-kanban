import { db } from './index';
import { users, boards, boardMembers, columns, cards, labels, cardLabels } from './schema';
import { validateDatabaseConfig } from './utils';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');
    
    // Validate environment variables
    validateDatabaseConfig();
    
    // Create demo user
    console.log('👤 Creating demo user...');
    const [demoUser] = await db.insert(users).values({
      id: 'demo-user-id', // In real app, this would be Supabase auth UID
      email: 'demo@kanban.app',
      name: 'Demo User',
    }).returning();

    console.log(`✅ Created user: ${demoUser.email}`);

    // Create demo board
    console.log('📋 Creating demo board...');
    const [demoBoard] = await db.insert(boards).values({
      name: 'Demo Kanban Board',
      ownerId: demoUser.id,
      isArchived: false,
    }).returning();

    console.log(`✅ Created board: ${demoBoard.name}`);

    // Add user as board owner
    await db.insert(boardMembers).values({
      boardId: demoBoard.id,
      userId: demoUser.id,
      role: 'owner',
    });

    // Create columns
    console.log('📝 Creating columns...');
    const columnData = [
      { title: 'To Do', position: 1 },
      { title: 'In Progress', position: 2 },
      { title: 'Done', position: 3 },
    ];

    const createdColumns = await db.insert(columns).values(
      columnData.map(col => ({
        boardId: demoBoard.id,
        title: col.title,
        position: col.position,
      }))
    ).returning();

    console.log(`✅ Created ${createdColumns.length} columns`);

    // Create labels
    console.log('🏷️ Creating labels...');
    const labelData = [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#3b82f6' },
      { name: 'Enhancement', color: '#10b981' },
      { name: 'Documentation', color: '#f59e0b' },
      { name: 'High Priority', color: '#dc2626' },
    ];

    const createdLabels = await db.insert(labels).values(
      labelData.map(label => ({
        boardId: demoBoard.id,
        name: label.name,
        color: label.color,
      }))
    ).returning();

    console.log(`✅ Created ${createdLabels.length} labels`);

    // Create cards
    console.log('🃏 Creating cards...');
    const cardData = [
      // To Do column
      {
        title: 'Set up project repository',
        description: 'Initialize the project with proper folder structure and dependencies',
        columnIndex: 0,
        position: 1,
        labelNames: ['Documentation'],
      },
      {
        title: 'Design user authentication flow',
        description: 'Create wireframes and user flow for login/signup process',
        columnIndex: 0,
        position: 2,
        labelNames: ['Feature'],
      },
      // In Progress column
      {
        title: 'Implement drag and drop functionality',
        description: 'Add @dnd-kit library and implement card movement between columns',
        columnIndex: 1,
        position: 1,
        labelNames: ['Feature', 'High Priority'],
        assigneeId: demoUser.id,
      },
      {
        title: 'Fix card deletion bug',
        description: 'Cards are not being properly removed from the database when deleted',
        columnIndex: 1,
        position: 2,
        labelNames: ['Bug', 'High Priority'],
        assigneeId: demoUser.id,
      },
      // Done column
      {
        title: 'Create database schema',
        description: 'Define all tables and relationships using Drizzle ORM',
        columnIndex: 2,
        position: 1,
        labelNames: ['Feature'],
        assigneeId: demoUser.id,
      },
    ];

    const createdCards = [];
    for (const cardInfo of cardData) {
      const [card] = await db.insert(cards).values({
        boardId: demoBoard.id,
        columnId: createdColumns[cardInfo.columnIndex].id,
        title: cardInfo.title,
        description: cardInfo.description,
        position: cardInfo.position,
        assigneeId: cardInfo.assigneeId || null,
      }).returning();

      createdCards.push(card);

      // Add labels to cards
      if (cardInfo.labelNames && cardInfo.labelNames.length > 0) {
        const cardLabelData = cardInfo.labelNames.map(labelName => {
          const label = createdLabels.find(l => l.name === labelName);
          return {
            cardId: card.id,
            labelId: label!.id,
          };
        });

        await db.insert(cardLabels).values(cardLabelData);
      }
    }

    console.log(`✅ Created ${createdCards.length} cards with labels`);

    console.log('\n🎉 Seed completed successfully!');
    console.log(`📋 Demo board ID: ${demoBoard.id}`);
    console.log(`👤 Demo user ID: ${demoUser.id}`);
    console.log(`🌐 Access the board at: /boards/${demoBoard.id}`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed script failed:', error);
      process.exit(1);
    });
}

export default seed;
