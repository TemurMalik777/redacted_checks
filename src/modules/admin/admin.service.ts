import { User } from '../index';

/**
 * Admin Service
 * 
 * Admin panel uchun yordamchi funksiyalar
 */
class AdminService {
  /**
   * Userni admin qilish
   * 
   * @param userId - User ID
   * @returns Updated user
   */
  async makeAdmin(userId: number): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User topilmadi');
    }

    await user.update({ role: 'admin' });

    return user;
  }

  /**
   * Adminni oddiy userga o'tkazish
   * 
   * @param userId - User ID
   * @returns Updated user
   */
  async removeAdmin(userId: number): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User topilmadi');
    }

    if (user.role !== 'admin') {
      throw new Error('Bu user admin emas');
    }

    await user.update({ role: 'user' });

    return user;
  }

  /**
   * Userni bloklash
   * 
   * @param userId - User ID
   * @returns Updated user
   */
  async blockUser(userId: number): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User topilmadi');
    }

    await user.update({ isActive: false });

    return user;
  }

  /**
   * Userni aktivlashtirish
   * 
   * @param userId - User ID
   * @returns Updated user
   */
  async unblockUser(userId: number): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User topilmadi');
    }

    await user.update({ isActive: true });

    return user;
  }

  /**
   * Userning parolini reset qilish
   * 
   * @param userId - User ID
   * @param newPassword - Yangi parol
   * @returns Updated user
   */
  async resetUserPassword(userId: number, newPassword: string): Promise<User> {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User topilmadi');
    }

    await user.update({ password: newPassword });

    return user;
  }

  /**
   * Barcha admin userlarni olish
   * 
   * @returns Array of admin users
   */
  async getAllAdmins(): Promise<User[]> {
    const admins = await User.findAll({
      where: {
        role: 'admin',
        isActive: true,
      },
      order: [['createdAt', 'DESC']],
    });

    return admins;
  }

  /**
   * Aktiv userlar sonini olish
   * 
   * @returns Count of active users
   */
  async getActiveUsersCount(): Promise<number> {
    const count = await User.count({
      where: {
        isActive: true,
      },
    });

    return count;
  }

  /**
   * Bloklangan userlar sonini olish
   * 
   * @returns Count of blocked users
   */
  async getBlockedUsersCount(): Promise<number> {
    const count = await User.count({
      where: {
        isActive: false,
      },
    });

    return count;
  }
}

export default new AdminService();