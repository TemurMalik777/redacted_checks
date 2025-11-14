import { User } from '../index';

/**
 * Admin Service
 */
class AdminService {
  /**
   * Userni admin qilish
   */
  async makeAdmin(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    await user.update({ role: 'admin' });
    return user;
  }

  /**
   * Admin roleni olib tashlash
   */
  async removeAdmin(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    if (user.role !== 'admin') {
      throw new Error('Bu user admin emas');
    }

    await user.update({ role: 'user' });
    return user;
  }

  /**
   * Userni bloklash
   */
  async blockUser(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    await user.update({ isActive: false });
    return user;
  }

  /**
   * Userni aktivlashtirish
   */
  async unblockUser(userId: number): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    await user.update({ isActive: true });
    return user;
  }

  /**
   * Userning parolini reset qilish
   */
  async resetUserPassword(userId: number, newPassword: string): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    // beforeUpdate hook avtomatik hash qiladi
    await user.update({ password: newPassword });
    return user;
  }

  /**
   * User roleni o'zgartirish (universal)
   */
  async changeUserRole(userId: number, newRole: 'user' | 'admin'): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User topilmadi');

    await user.update({ role: newRole });
    return user;
  }

  /**
   * Barcha adminlarni olish
   */
  async getAllAdmins(): Promise<User[]> {
    return await User.findAll({
      where: {
        role: 'admin',
        isActive: true,
      },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Aktiv userlar soni
   */
  async getActiveUsersCount(): Promise<number> {
    return await User.count({
      where: { isActive: true },
    });
  }

  /**
   * Bloklangan userlar soni
   */
  async getBlockedUsersCount(): Promise<number> {
    return await User.count({
      where: { isActive: false },
    });
  }

  /**
   * Role bo'yicha userlar soni
   */
  async getUserCountByRole(role: 'user' | 'admin'): Promise<number> {
    return await User.count({
      where: { role },
    });
  }
}

export default new AdminService();