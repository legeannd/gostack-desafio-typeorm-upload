import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

/* Arquivo é importado usando sistema de stream, que lê todos os dados de um arquivo de maneira assíncrona,
para que o sistema possa ser utilizado enquanto o arquivo é lido */

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const readCSVStream = fs.createReadStream(filePath);

    const parseStream = csvParse({
      from_line: 2,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    /* A cada linha que é lida no arquivo, é disparado um evento do tipo data.
    Com isso, é possível tratar o formato de cada linha individualmente  */

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    /* Espera o fim da leitura do arquivo */

    await new Promise(resolve => parseCSV.on('end', resolve));

    /* Verifica se as categorias passadas pelo arquivo já existem na tabela de categorias do banco */

    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    /* Cria todas as categorias que foram passadas pelo arquivo mas que não existem na tabela de categorias */

    const newCategories = categoryRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategories);

    /* Junta as categorias já existentes anteriormente no banco com as que foram adicionadas na leitura do arquivo */

    const finalCategories = [...newCategories, ...existentCategories];

    /* As transações correspondentes ao arquivo são criadas com as suas respectivas categorias */

    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransactions);

    /* O arquivo de importação das transações é removido da pasta de importação */

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
