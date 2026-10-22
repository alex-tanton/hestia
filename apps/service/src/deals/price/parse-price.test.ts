import { describe, expect, it } from 'vitest';
import { parsePrice, withoutImplausibleOriginal } from './parse-price.js';
import { buildCopy, detectQualifier, formatDisplayPrice, type PriceCopy } from './price-copy.js';
import {
  parseAmountOff,
  parseBogo,
  parseBuyNGetM,
  parseDirectPrice,
  parseMinimumQuantity,
  parseMixAndMatchLimit,
  parseMultiBuy,
  parsePackagePricedByWeight,
  parsePerWeight,
  parsePercentOffNoBase,
  parseRebate,
} from './parsers.js';

/**
 * Every case below is copy recorded from the 27514 captures unless it is marked as coming from the
 * price-normalization rules table, which is the oracle where the capture has no example. Tests
 * never call Flipp.
 */
function copy(fields: Partial<PriceCopy>): PriceCopy {
  return {
    currentPrice: null,
    originalPrice: null,
    prePriceText: null,
    postPriceText: null,
    saleStory: null,
    ...fields,
  };
}

describe('parsePrice: the Requirements table, row by row', () => {
  it('direct price with an original', () => {
    // ALDI "Peanut Delight No-Stir Creamy Peanut Butter": PRICE DROPS, $1.45, was $1.95.
    expect(
      parsePrice(copy({ currentPrice: 145, originalPrice: 195, prePriceText: 'PRICE DROPS' })),
    ).toMatchObject({
      parsed: {
        unitPrice: 145,
        priceUnit: 'each',
        originalPrice: 195,
        discountPercent: 25,
        displayPrice: 'PRICE DROPS $1.45',
        conditionalPrice: false,
        conditionalReason: null,
      },
    });
  });

  it('per-pound price', () => {
    // Food Lion "Broccoli Crowns": MVP, $1.99, LB.
    expect(
      parsePrice(
        copy({
          currentPrice: 199,
          prePriceText: 'MVP',
          postPriceText: 'LB',
          saleStory: 'HOT SALE!!!',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 199,
        priceUnit: 'lb',
        displayPrice: 'MVP $1.99 LB',
        conditionalPrice: true,
        conditionalReason: 'loyalty_card',
      },
    });
  });

  it('per-pound price written "Per Lb."', () => {
    // ALDI "California Red Grapes".
    expect(parsePrice(copy({ currentPrice: 129, postPriceText: 'Per Lb.' }))).toMatchObject({
      parsed: { unitPrice: 129, priceUnit: 'lb' },
    });
  });

  it('per-pound price written "per Ib", the OCR misreading', () => {
    // Harris Teeter "Alaska Sockeye Salmon Fillets": eleven captured items read "per Ib".
    expect(parsePrice(copy({ currentPrice: 1599, postPriceText: 'per Ib' }))).toMatchObject({
      parsed: { unitPrice: 1599, priceUnit: 'lb' },
    });
  });

  it('per-pound price written "/lb"', () => {
    // Lidl "Butcher's Specialty fresh bone-in chicken thighs": $0.99 /lb, was $1.29.
    expect(
      parsePrice(copy({ currentPrice: 99, originalPrice: 129, postPriceText: '/lb' })),
    ).toMatchObject({
      parsed: { unitPrice: 99, priceUnit: 'lb', originalPrice: 129, discountPercent: 23 },
    });
  });

  it('per-ounce price: /oz gives oz', () => {
    expect(parsePrice(copy({ currentPrice: 49, postPriceText: '/oz' }))).toMatchObject({
      parsed: { unitPrice: 49, priceUnit: 'oz' },
    });
  });

  it('package price worded by weight is priced each', () => {
    // ALDI "Washington Bartlett Pears": $3.29 Per 3-Lb. Bag — the bag, not the pound.
    expect(
      parsePrice(
        copy({ currentPrice: 329, prePriceText: 'PRICE DROPS', postPriceText: 'Per 3-Lb. Bag' }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 329,
        priceUnit: 'each',
        displayPrice: 'PRICE DROPS $3.29 Per 3-Lb. Bag',
      },
    });
  });

  it('package price worded by ounces is priced each', () => {
    // ALDI "Sliced White Mushrooms": $1.29 Per 8-oz. Pkg.
    expect(parsePrice(copy({ currentPrice: 129, postPriceText: 'Per 8-oz. Pkg.' }))).toMatchObject({
      parsed: { unitPrice: 129, priceUnit: 'each' },
    });
  });

  it('multi-buy divides and keeps the copy', () => {
    // Harris Teeter "Harris Teeter Snack Cheese": 2/$6.00 with your VIC card.
    expect(
      parsePrice(
        copy({
          currentPrice: 600,
          prePriceText: '2/',
          saleStory: 'save big on 2 with your VIC card',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 300,
        priceUnit: 'each',
        displayPrice: '2/$6.00',
        conditionalPrice: true,
        conditionalReason: 'loyalty_card',
      },
    });
  });

  it('multi-buy rounds half-up', () => {
    // Harris Teeter "Harris Teeter 100% Pure Pumpkin": 3/$5.00, original $5.96 — both divide.
    expect(
      parsePrice(
        copy({
          currentPrice: 500,
          originalPrice: 596,
          prePriceText: '3/',
          saleStory: 'save at least 96¢ on 3 with your VIC card',
        }),
      ),
    ).toMatchObject({
      parsed: { unitPrice: 167, originalPrice: 199, discountPercent: 16 },
    });
  });

  it('multi-buy written "2 for"', () => {
    // Harris Teeter "La Tortilla Factory Tortilla": 2 for $7.00.
    expect(parsePrice(copy({ currentPrice: 700, prePriceText: '2 for' }))).toMatchObject({
      parsed: { unitPrice: 350, displayPrice: '2 for $7.00' },
    });
  });

  it('a bundle original divides with the bundle', () => {
    // Lowes Foods "Stouffer's Entrees": FINAL PRICE 2/$4.00, original $6.00, digital coupon.
    expect(
      parsePrice(
        copy({
          currentPrice: 400,
          originalPrice: 600,
          prePriceText: 'FINAL PRICE 2/',
          saleStory: 'DIGITAL COUPON $2 OFF TWO',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 200,
        originalPrice: 300,
        discountPercent: 33,
        displayPrice: 'FINAL PRICE 2/$4.00',
        conditionalPrice: true,
        conditionalReason: 'coupon',
      },
    });
  });

  it('an implausible original is treated as unknown', () => {
    // Restaurant Depot "Philadelphia's Finest Chicken Steak": $2.39 LB against $23.90, a case
    // price. Ten times the unit price or more is a different unit, not a 90% discount.
    expect(
      parsePrice(copy({ currentPrice: 239, originalPrice: 2390, postPriceText: 'LB' })),
    ).toMatchObject({
      parsed: { unitPrice: 239, priceUnit: 'lb', originalPrice: null, discountPercent: null },
    });
  });

  it('BOGO with a known base price is half of it', () => {
    // Publix "Mifroma Le Gruyère AOP Cheese† BOGO*": Buy 1 Get 1 FREE* over $9.49.
    expect(
      parsePrice(
        copy({
          currentPrice: 949,
          prePriceText: 'Buy 1 Get 1 FREE*',
          saleStory: 'SAVE UP TO $9.49',
        }),
      ),
    ).toMatchObject({
      parsed: { unitPrice: 475, originalPrice: 949, discountPercent: 50, priceUnit: 'each' },
    });
  });

  it('BOGO with no base price is skipped', () => {
    // Harris Teeter "Chicken Breast or Tenderloins", printed with no price at all.
    expect(
      parsePrice(
        copy({
          saleStory: 'BUY 1 GET 1 FREE each item rings at half price with your VIC card',
        }),
      ),
    ).toEqual({ skipped: 'bogo_no_base' });
  });

  it('buy-N-get-M free other than BOGO is skipped, base price or not', () => {
    // Food Lion "Food Lion Cream Cheese": MVP $1.99 EA with "BUY 2 GET 1 FREE".
    expect(
      parsePrice(
        copy({
          currentPrice: 199,
          prePriceText: 'MVP',
          postPriceText: 'EA',
          saleStory: 'BUY 2 GET 1 FREE',
        }),
      ),
    ).toEqual({ skipped: 'buy_n_get_m' });
    // Publix "Blue Bunny Mini Swirls": BUY 2 GET 3 Free!, no price.
    expect(parsePrice(copy({ saleStory: 'BUY 2 GET 3 Free!' }))).toEqual({
      skipped: 'buy_n_get_m',
    });
  });

  it('buy-N-get-an-amount-off is skipped', () => {
    // Harris Teeter "BUY 2 GET $8.00 OFF" / "Buy 2 Get $8.00 Off, SAVE $8.00 ON 2".
    expect(
      parsePrice(
        copy({
          currentPrice: 1999,
          prePriceText: 'BUY 2 GET $8.00 OFF',
          saleStory: 'Buy 2 Get $8.00 Off, SAVE $8.00 ON 2',
        }),
      ),
    ).toEqual({ skipped: 'buy_n_get_m' });
  });

  it('buy-N-get-an-amount-off is skipped when the flyer omits the dollar sign', () => {
    // Publix Liquors prints both forms. "Jack Daniel's Single Barrel": Buy 2 Get $6.00 Off.
    // "Jameson Black Barrel": Buy 2 Get 10.00 Off, over $37.99 — not the price of one bottle
    // under that offer, so it has to skip exactly like its sibling.
    expect(parsePrice(copy({ currentPrice: 3799, saleStory: 'Buy 2 Get 10.00 Off' }))).toEqual({
      skipped: 'buy_n_get_m',
    });
  });

  it('buy-N-get-M free is skipped when a filler word separates "buy" from the count', () => {
    // Food Lion prints both "BUY 2 GET 1 FREE" (Glacéau Smart Water) and "HOT SALE!! BUY ANY 2
    // GET 1 FREE!" (V8 V-Fusion), the second over $5.99 EA.
    expect(
      parsePrice(
        copy({
          currentPrice: 599,
          postPriceText: 'EA',
          saleStory: 'HOT SALE!! BUY ANY 2 GET 1 FREE!',
        }),
      ),
    ).toEqual({ skipped: 'buy_n_get_m' });
  });

  it('still halves a buy-one-get-one written with that same filler word', () => {
    expect(
      parsePrice(copy({ currentPrice: 949, prePriceText: 'Buy any 1 Get any 1 FREE*' })),
    ).toMatchObject({ parsed: { unitPrice: 475, originalPrice: 949, discountPercent: 50 } });
  });

  it('buy-one-get-one at a partial discount is skipped', () => {
    // CVS "ALL CVS batteries": Buy 1 get 1 50% OFF* WITH CARD. Not free, so not a 50% BOGO.
    expect(parsePrice(copy({ saleStory: 'Buy 1 get 1 50% OFF* WITH CARD' }))).toEqual({
      skipped: 'buy_n_get_m',
    });
  });

  it('minimum-quantity pricing is skipped', () => {
    // Lowes Foods "Liquid Death Sparkling Energy": $1.95 ea MUST BUY 2.
    expect(parsePrice(copy({ currentPrice: 195, postPriceText: 'ea MUST BUY 2' }))).toEqual({
      skipped: 'minimum_quantity',
    });
    // Harris Teeter "Harris Teeter Granulated Sugar": $2.97 when you buy 4.
    expect(
      parsePrice(
        copy({
          currentPrice: 297,
          saleStory: 'save at least $2.08 over our already low VIC price when you buy 4',
        }),
      ),
    ).toEqual({ skipped: 'minimum_quantity' });
  });

  it('percent off with no base price is skipped', () => {
    // CVS "25% OFF WITH CARD", printed with no price.
    expect(parsePrice(copy({ saleStory: '25% OFF WITH CARD' }))).toEqual({
      skipped: 'percent_off_no_base',
    });
  });

  it('percent off beside a shelf price parses the shelf price', () => {
    // Food Lion "Post Pebbles or Honey Bunches of Oats Cereal": $2.55 EA, was $3.19, -20% OFF.
    expect(
      parsePrice(
        copy({
          currentPrice: 255,
          originalPrice: 319,
          prePriceText: 'MVP',
          postPriceText: 'EA',
          saleStory: 'HOT SALE!!, -20% OFF',
        }),
      ),
    ).toMatchObject({ parsed: { unitPrice: 255, originalPrice: 319, discountPercent: 20 } });
  });

  it('an amount off a known original subtracts', () => {
    // Family Dollar prints "Sale! $1 OFF" as the whole price copy; the seed data's amount-off
    // fixture supplies the original it is taken off ("reg $5.49" → $4.49, 18% off).
    expect(parsePrice(copy({ originalPrice: 549, prePriceText: 'Sale! $1 OFF' }))).toMatchObject({
      parsed: { unitPrice: 449, originalPrice: 549, discountPercent: 18 },
    });
  });

  it('an amount off with no original is skipped', () => {
    // Family Dollar "Banquet Crispy Chicken Fillets": Sale! $1 OFF, no price, no original.
    expect(parsePrice(copy({ prePriceText: 'Sale! $1 OFF' }))).toEqual({
      skipped: 'amount_off_no_original',
    });
    // Publix "Zyrtec Allergy Shield Spray": $5.00 off WITH MFR DIGITAL COUPON Any 1.
    expect(parsePrice(copy({ saleStory: '$5.00 off WITH MFR DIGITAL COUPON Any 1' }))).toEqual({
      skipped: 'amount_off_no_original',
    });
  });

  it('a digital-coupon qualifier parses the price and flags the coupon', () => {
    // Lowes Foods "Fa!rlife Milk": FINAL PRICE $3.99, was $4.99, $1 OFF ONE DIGITAL COUPON.
    expect(
      parsePrice(
        copy({
          currentPrice: 399,
          originalPrice: 499,
          prePriceText: 'FINAL PRICE',
          saleStory: '$1 OFF ONE DIGITAL COUPON',
        }),
      ),
    ).toMatchObject({
      parsed: { unitPrice: 399, conditionalPrice: true, conditionalReason: 'coupon' },
    });
  });

  it('a loyalty-card qualifier parses the price and flags the card', () => {
    // Food Lion "MVP" prefix, Harris Teeter's VIC card, CVS's "WITH CARD", and a membership
    // price are all the same conditional.
    for (const fields of [
      { currentPrice: 699, prePriceText: 'MVP', postPriceText: 'EA' },
      { currentPrice: 399, saleStory: 'save at least 70c each with your VIC card' },
      { currentPrice: 1999, postPriceText: 'WITH CARD' },
      { currentPrice: 899, saleStory: 'save at least $3.00 each with membership' },
      { currentPrice: 699, saleStory: 'save at least $2.00 per lb with myVIC card' },
    ]) {
      expect(parsePrice(copy(fields))).toMatchObject({
        parsed: { conditionalPrice: true, conditionalReason: 'loyalty_card' },
      });
    }
  });

  it('a rebate is not a shelf price', () => {
    // CVS "ANY CVS Brand diabetes care": Spend $25 get $5 ExtraBucks Rewards®◆ WITH CARD.
    expect(
      parsePrice(copy({ saleStory: 'Spend $25 get $5 ExtraBucks Rewards®◆ WITH CARD' })),
    ).toEqual({ skipped: 'rebate' });
    // "FREE with $25 purchase" is the other rebate shape.
    expect(parsePrice(copy({ saleStory: 'FREE with $25 purchase' }))).toEqual({
      skipped: 'rebate',
    });
  });

  it('a shelf price with a secondary rebate parses the shelf price', () => {
    // CVS "Colgate Optic White Advanced": $4.79 WITH CARD, was $9.79, with a coupon and a
    // Buy 2 get $6 ExtraBucks offer stacked on top. The rebate is ignored.
    expect(
      parsePrice(
        copy({
          currentPrice: 479,
          originalPrice: 979,
          postPriceText: 'WITH CARD',
          saleStory:
            'Also get savings with $5.00 on 2 Digital mfr coupon + Buy 2 get $6 ExtraBucks Rewards®⬩',
        }),
      ),
    ).toMatchObject({
      parsed: {
        unitPrice: 479,
        originalPrice: 979,
        discountPercent: 51,
        conditionalPrice: true,
        conditionalReason: 'loyalty_card',
      },
    });
  });

  it('mix-and-match with a purchase limit is skipped', () => {
    // The canonical example; the 27514 capture has no purchase limit in it.
    expect(
      parsePrice(
        copy({
          currentPrice: 1000,
          prePriceText: 'Mix & Match 10/',
          saleStory: 'with card, limit 2, select varieties',
        }),
      ),
    ).toEqual({ skipped: 'mix_and_match' });
  });

  it('no price at all is skipped', () => {
    // Harris Teeter "CLR Cleaner or Lime & Rust Remover" carries an empty price string.
    expect(parsePrice(copy({}))).toEqual({ skipped: 'no_price' });
    expect(parsePrice(copy({ saleStory: 'HOT SALE!!' }))).toEqual({ skipped: 'no_price' });
  });

  it('never returns a zero or negative unit price', () => {
    // A fabricated price is worse than a missing deal.
    expect(
      parsePrice(copy({ currentPrice: 1, prePriceText: 'Sale! $1 OFF', originalPrice: 100 })),
    ).toMatchObject({ parsed: { unitPrice: 1 } });
    expect(parsePrice(copy({ originalPrice: 100, prePriceText: 'Sale! $1 OFF' }))).toEqual({
      skipped: 'amount_off_no_original',
    });
  });
});

describe('the parsers in isolation', () => {
  const at = (fields: Partial<PriceCopy>) => buildCopy(copy(fields));

  it('each parser passes on copy that is not its shape', () => {
    const plain = at({ currentPrice: 399 });
    for (const parser of [
      parseRebate,
      parseMixAndMatchLimit,
      parseMinimumQuantity,
      parseBuyNGetM,
      parseBogo,
      parsePercentOffNoBase,
      parseAmountOff,
      parseMultiBuy,
      parsePackagePricedByWeight,
      parsePerWeight,
    ]) {
      expect(parser(plain)).toBeNull();
    }
    expect(parseDirectPrice(plain)).toEqual({
      unitPrice: 399,
      priceUnit: 'each',
      originalPrice: null,
    });
  });

  it('parseMultiBuy reads the multiplier only from the pre-price text', () => {
    // "/lb" and "/cs" start with the same slash and mean something else entirely.
    expect(parseMultiBuy(at({ currentPrice: 999, postPriceText: '/lb' }))).toBeNull();
    expect(parseMultiBuy(at({ currentPrice: 999, saleStory: 'save big on 2' }))).toBeNull();
    expect(parseMultiBuy(at({ currentPrice: 1400, prePriceText: '2/' }))).toEqual({
      unitPrice: 700,
      priceUnit: 'each',
      originalPrice: null,
    });
  });

  it('parseMultiBuy ignores a pre-price text that is not a multiplier', () => {
    // Restaurant Depot's "25 LB TUB" is a package description.
    expect(parseMultiBuy(at({ currentPrice: 6499, prePriceText: '25 LB TUB' }))).toBeNull();
  });

  it('parsePerWeight takes the unit from the sale story when the price text has none', () => {
    // Harris Teeter "93% Lean Ground Beef": $6.99 with "save at least $2.00 per lb with myVIC".
    expect(
      parsePerWeight(
        at({ currentPrice: 699, saleStory: 'save at least $2.00 per lb with myVIC card' }),
      ),
    ).toEqual({ unitPrice: 699, priceUnit: 'lb', originalPrice: null });
  });

  it('parsePerWeight is not fooled by other post-price text', () => {
    for (const post of ['EA', 'each', 'ea.', '/cs', 'or reg retail ea. WITH CARD', '-7.20']) {
      expect(parsePerWeight(at({ currentPrice: 675, postPriceText: post }))).toBeNull();
    }
  });

  it('withoutImplausibleOriginal keeps an original under ten times the price', () => {
    const core = { unitPrice: 479, priceUnit: 'each' as const, originalPrice: 979 };
    expect(withoutImplausibleOriginal(core)).toEqual(core);
    expect(withoutImplausibleOriginal({ ...core, originalPrice: 4790 })).toEqual({
      ...core,
      originalPrice: null,
    });
  });
});

describe('display copy and qualifiers', () => {
  it('runs a slash-terminated prefix straight into the price', () => {
    expect(formatDisplayPrice(copy({ currentPrice: 600, prePriceText: '2/' }))).toBe('2/$6.00');
    expect(formatDisplayPrice(copy({ currentPrice: 500, prePriceText: 'MVP 2/' }))).toBe(
      'MVP 2/$5.00',
    );
  });

  it('keeps pre- and post-price text around the price', () => {
    expect(
      formatDisplayPrice(copy({ currentPrice: 199, prePriceText: 'MVP', postPriceText: 'LB' })),
    ).toBe('MVP $1.99 LB');
    expect(formatDisplayPrice(copy({ currentPrice: 1899 }))).toBe('$18.99');
  });

  it('the card wins over a coupon offered alongside it', () => {
    expect(
      detectQualifier(
        buildCopy(
          copy({
            currentPrice: 1999,
            postPriceText: 'WITH CARD',
            saleStory: 'Also get savings with $5.00 Digital mfr coupon',
          }),
        ),
      ),
    ).toBe('loyalty_card');
  });

  it('a card named only after the secondary clause still counts', () => {
    expect(
      detectQualifier(
        buildCopy(
          copy({
            currentPrice: 1999,
            saleStory: 'Also get savings with $5.00 Digital mfr coupon WITH CARD',
          }),
        ),
      ),
    ).toBe('loyalty_card');
  });

  it('is unconditional when nothing qualifies the price', () => {
    expect(
      detectQualifier(buildCopy(copy({ currentPrice: 399, saleStory: 'HOT SALE!!' }))),
    ).toBeNull();
  });
});
