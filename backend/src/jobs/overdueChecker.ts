import cron from 'node-cron';
import { Rental, Equipment, Alert } from '../models';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';
import { getIO } from '../config/socket';

export function startOverdueChecker(): void {
  // Run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      const now = new Date();

      // 1. Find active rentals past expectedReturnDate (OVERDUE)
      const overdueRentals = await Rental.find({
        status: 'ACTIVE',
        expectedReturnDate: { $lt: now },
      });

      for (const rental of overdueRentals) {
        rental.status = 'OVERDUE';
        await rental.save();

        await Equipment.updateOne(
          { equipmentId: rental.equipmentId },
          { $set: { status: 'OVERDUE' } }
        );

        // Check if active alert already exists
        const existingAlert = await Alert.findOne({
          equipmentId: rental.equipmentId,
          type: 'OVERDUE',
          status: 'ACTIVE',
        });

        if (!existingAlert) {
          const alert = await Alert.create({
            alertId: generateId('ALT'),
            type: 'OVERDUE',
            title: 'RENTAL AGREEMENT OVERDUE',
            equipmentId: rental.equipmentId,
            siteId: rental.siteId,
            severity: 'CRITICAL',
            message: `Equipment ${rental.equipmentId} rented by ${rental.customerName || 'Contractor'} is OVERDUE since ${rental.expectedReturnDate.toLocaleDateString()}.`,
            currentValue: 'OVERDUE',
            threshold: 'Target Return Milestone Passed',
            recommendation: 'Initiate immediate return inspection or process official agreement extension.',
            status: 'ACTIVE',
            isRead: false,
          });

          try {
            getIO().emit('alert:new', alert);
          } catch (e) {}

          logger.info(`Overdue alert generated for equipment ${rental.equipmentId}`);
        }
      }

      // 2. Find active rentals approaching return deadline within next 48 hours (APPROACHING DEADLINE REMINDER)
      const futureWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const approachingRentals = await Rental.find({
        status: 'ACTIVE',
        expectedReturnDate: { $gte: now, $lte: futureWindow },
      });

      for (const rental of approachingRentals) {
        const alertKey = `APPROACHING:${rental.rentalId}:${rental.expectedReturnDate.toISOString().split('T')[0]}`;
        const existingReminder = await Alert.findOne({
          alertKey,
          status: 'ACTIVE',
        });

        if (!existingReminder) {
          const alert = await Alert.create({
            alertId: generateId('ALT'),
            alertKey,
            type: 'OVERDUE',
            title: 'RETURN DEADLINE APPROACHING',
            equipmentId: rental.equipmentId,
            siteId: rental.siteId,
            severity: 'WARNING',
            message: `Rental agreement ${rental.rentalId} for ${rental.equipmentId} (${rental.customerName || 'Contractor'}) return milestone is due on ${rental.expectedReturnDate.toLocaleDateString()}.`,
            currentValue: 'Due in <48 hrs',
            threshold: '48h Window',
            recommendation: `Contact ${rental.contactPerson || 'Site Engineer'} to confirm on-time check-in or submit 7-day contract extension.`,
            status: 'ACTIVE',
            isRead: false,
          });

          try {
            getIO().emit('alert:new', alert);
          } catch (e) {}

          logger.info(`Approaching return reminder generated for rental ${rental.rentalId}`);
        }
      }
    } catch (error) {
      logger.error('Error in overdueChecker job:', error);
    }
  });

  logger.info('Scheduled job [OverdueChecker & Return Reminders] started (interval: 1 min)');
}
