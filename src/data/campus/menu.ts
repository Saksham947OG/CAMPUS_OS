import type { MenuData } from '@/selectors/chill'
import type { MenuItem } from '@/domain/chill'
import { supplied } from './catalogue'

const categories = [
  'Fries',
  'Pasta',
  'Burgers',
  'Wraps',
  'Sandwiches',
  'Maggi',
  'Eggs',
  'Sides',
  'Mojitos',
  'Hot drinks',
  'Shakes',
]
type Row = [string, number, number, number?]
const rows: Row[] = [
  ['Golden Crisp Fries', 0, 69, 119],
  ['Peri Peri Fries', 0, 79, 129],
  ['Loaded Fries', 0, 89, 149],
  ['White Sauce Pasta', 1, 119],
  ['Red Sauce Pasta', 1, 119],
  ['Veggie Loaded Burger', 2, 79],
  ['Kings Burger (2 tikki)', 2, 99],
  ['Cheese Melt Burger', 2, 99],
  ['Paneer Makhani Burger', 2, 99],
  ['Egg Burger (2 eggs)', 2, 99],
  ['Veggi Tadka Wrap', 3, 89],
  ['Paneer-e-Zaika Wrap', 3, 99],
  ['Paneer Bhurji Wrap', 3, 119],
  ['Cheese Melt Wrap', 3, 99],
  ['Classic Veggie Sandwich', 4, 79],
  ['Double Trouble Cheese Sandwich', 4, 99],
  ['Paneer Makhani Sandwich', 4, 99],
  ['Egg Maggi (2 eggs)', 5, 79],
  ['Masala Maggi', 5, 39],
  ['Butter Maggi', 5, 45],
  ['Veggie Maggi', 5, 49],
  ['Peri Peri Maggi', 5, 45],
  ['Masala Omelette', 6, 49],
  ['Bread Omelette', 6, 55],
  ['Cheese Omelette', 6, 65],
  ['Egg Bhurji', 6, 55],
  ['Boiled Egg (each)', 6, 15],
  ['Veggie Fingers (4)', 7, 49],
  ['Crispy Nuggets (6)', 7, 49],
  ['Corn Chaat', 7, 79],
  ['Green Apple Mojito', 8, 59],
  ['Strawberry Mojito', 8, 59],
  ['Bubblegum Mojito', 8, 59],
  ['Blueberry Mojito', 8, 59],
  ['Peach Mojito', 8, 59],
  ['Chai', 9, 30, 50],
  ['Masala Chai', 9, 40, 60],
  ['Coffee', 9, 40, 50],
  ['Cold Coffee', 10, 79],
  ['Chocolate Shake', 10, 79],
  ['Oreo Shake', 10, 89],
]
export function campusMenu(): MenuData {
  return {
    categories: categories.map((label, i) => ({ id: `cafe-${i}`, label })),
    items: rows.map(([name, category, price, large], i): MenuItem => ({
      id: `chill-menu-${i}`,
      name,
      categoryId: `cafe-${category}`,
      priceMinor: price * 100,
      visible: true,
      availability: 'available',
      description:
        'Price transcribed from the supplied Chill Spot menu photograph. Ordering is saved on this device; stock has not been confirmed.',
      ...(large
        ? {
            options: [
              {
                id: 'large',
                label: category === 0 ? 'Large' : 'Higher-priced option (size label not supplied)',
                priceDeltaMinor: (large - price) * 100,
              },
            ],
          }
        : {}),
      provenance: supplied('Chill Spot menu board · supplied Nov 2 photograph; stock illustrative'),
    })),
  }
}
