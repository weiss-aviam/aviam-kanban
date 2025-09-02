import { db } from './index';
import { users, boards, boardMembers, columns, cards, labels, cardLabels, comments } from './schema';
import { validateDatabaseConfig } from './utils';

async function resetDatabase() {
  try {
    console.log('🧹 Starting database reset...');
    
    // Validate environment variables
    validateDatabaseConfig();
    
    // Delete all data in reverse dependency order
    console.log('🗑️ Deleting comments...');
    await db.delete(comments);
    
    console.log('🗑️ Deleting card labels...');
    await db.delete(cardLabels);
    
    console.log('🗑️ Deleting cards...');
    await db.delete(cards);
    
    console.log('🗑️ Deleting labels...');
    await db.delete(labels);
    
    console.log('🗑️ Deleting columns...');
    await db.delete(columns);
    
    console.log('🗑️ Deleting board members...');
    await db.delete(boardMembers);
    
    console.log('🗑️ Deleting boards...');
    await db.delete(boards);
    
    console.log('🗑️ Deleting users...');
    await db.delete(users);
    
    console.log('✅ Database reset completed successfully!');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Run reset if this file is executed directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('✅ Reset script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Reset script failed:', error);
      process.exit(1);
    });
}

export default resetDatabase;
