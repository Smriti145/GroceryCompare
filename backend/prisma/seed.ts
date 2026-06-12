import prisma from '../src/config/prisma';

async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production');

  const products = [
    {
      name: 'Amul Milk',
      brand: 'Amul',
      category: 'Dairy',
      variants: [
        {
          platform: 'BLINKIT',
          platformSku: 'BL001',
          platformName: 'Amul Gold Milk 500ml',
          quantity: '500ml',
          price: 34,
          deliveryTime: 10,
        },
        {
          platform: 'ZEPTO',
          platformSku: 'ZP001',
          platformName: 'Amul Gold Fresh Milk',
          quantity: '500ml',
          price: 32,
          deliveryTime: 12,
        },
        {
          platform: 'SWIGGY',
          platformSku: 'SW001',
          platformName: 'Amul Full Cream Milk',
          quantity: '500ml',
          price: 35,
          deliveryTime: 8,
        },
      ],
    },
    {
      name: 'Aashirvaad Atta',
      brand: 'Aashirvaad',
      category: 'Staples',
      variants: [
        {
          platform: 'BLINKIT',
          platformSku: 'BL002',
          platformName: 'Aashirvaad Whole Wheat Atta 5kg',
          quantity: '5kg',
          price: 245,
          deliveryTime: 15,
        },
        {
          platform: 'ZEPTO',
          platformSku: 'ZP002',
          platformName: 'Aashirvaad Chakki Atta 5kg',
          quantity: '5kg',
          price: 239,
          deliveryTime: 18,
        },
        {
          platform: 'SWIGGY',
          platformSku: 'SW002',
          platformName: 'Aashirvaad Atta Premium 5kg',
          quantity: '5kg',
          price: 250,
          deliveryTime: 12,
        },
      ],
    },
    {
      name: 'Tata Salt',
      brand: 'Tata',
      category: 'Staples',
      variants: [
        {
          platform: 'BLINKIT',
          platformSku: 'BL003',
          platformName: 'Tata Salt 1kg',
          quantity: '1kg',
          price: 28,
          deliveryTime: 8,
        },
        {
          platform: 'ZEPTO',
          platformSku: 'ZP003',
          platformName: 'Tata Iodized Salt',
          quantity: '1kg',
          price: 26,
          deliveryTime: 10,
        },
        {
          platform: 'SWIGGY',
          platformSku: 'SW003',
          platformName: 'Tata Salt Pure',
          quantity: '1kg',
          price: 29,
          deliveryTime: 7,
        },
      ],
    },
    {
      name: 'Maggi Noodles',
      brand: 'Nestle',
      category: 'Snacks',
      variants: [
        {
          platform: 'BLINKIT',
          platformSku: 'BL004',
          platformName: 'Maggi Masala Noodles Pack',
          quantity: '280g',
          price: 56,
          deliveryTime: 9,
        },
        {
          platform: 'ZEPTO',
          platformSku: 'ZP004',
          platformName: 'Maggi Family Pack',
          quantity: '280g',
          price: 54,
          deliveryTime: 11,
        },
        {
          platform: 'SWIGGY',
          platformSku: 'SW004',
          platformName: 'Maggi Masala Pack',
          quantity: '280g',
          price: 58,
          deliveryTime: 8,
        },
      ],
    },
    {
      name: 'Parle-G Biscuits',
      brand: 'Parle',
      category: 'Snacks',
      variants: [
        {
          platform: 'BLINKIT',
          platformSku: 'BL005',
          platformName: 'Parle-G Gold',
          quantity: '500g',
          price: 48,
          deliveryTime: 7,
        },
        {
          platform: 'ZEPTO',
          platformSku: 'ZP005',
          platformName: 'Parle-G Family Pack',
          quantity: '500g',
          price: 45,
          deliveryTime: 9,
        },
        {
          platform: 'SWIGGY',
          platformSku: 'SW005',
          platformName: 'Parle-G Value Pack',
          quantity: '500g',
          price: 49,
          deliveryTime: 6,
        },
      ],
    },
  ];

  await prisma.$transaction(async tx => {
    for (const [index, product] of products.entries()) {
      const id = `00000000-0000-4000-8000-${String(index + 1).padStart(
        12,
        '0',
      )}`;
      const data = {
        name: product.name,
        brand: product.brand,
        category: product.category,
        quantity: product.variants[0].quantity,
      };
      await tx.product.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
      for (const variant of product.variants) {
        const offer = {
          ...variant,
          productId: id,
          location: 'DEMO',
          isDemo: true,
          available: true,
          updatedAt: new Date(),
        };
        await tx.variant.upsert({
          where: {
            platform_platformSku_location: {
              platform: variant.platform,
              platformSku: variant.platformSku,
              location: 'DEMO',
            },
          },
          create: offer,
          update: offer,
        });
      }
    }
  });

  console.log('Seeded successfully');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
