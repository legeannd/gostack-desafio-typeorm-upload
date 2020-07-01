import { getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  id: string;
}

/* Verifica se a transação existe e a deleta, ou joga um erro */

class DeleteTransactionService {
  public async execute({ id }: Request): Promise<void> {
    const transactionRepository = getCustomRepository(TransactionsRepository);

    try {
      const transaction = await transactionRepository.findOne({
        where: {
          id,
        },
      });
      if (transaction) {
        await transactionRepository.delete(transaction.id);
      }
    } catch (err) {
      throw new AppError('Unable to delete transaction');
    }
  }
}

export default DeleteTransactionService;
