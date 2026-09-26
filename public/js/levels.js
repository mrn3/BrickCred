// One unique beast per level, silliest first. Every 10th level is a boss.
const BEAST_NAMES = [
  'Wobbly Jelly Bean', 'Sock Puppet Pete', 'Grumpy Toast', 'Derpy Pigeon', 'Disco Potato',
  'Sir Snailsworth', 'Mustache Muffin', 'Rubber Ducky of Doom', 'Tickle Octopus', 'King Wobbles the Gelatin',
  'Sneezy Cactus', 'Chompy Lunchbox', 'Cranky Crab', 'Angry Garden Gnome', 'Moldy Cheese Wheel',
  'Bouncy Mushroom Bro', 'Haunted Vacuum', 'Party Llama', 'Toxic Slime', 'Grimjaw the Cruel',
  'Sludge Goblin', 'Fire Imp', 'Brick Muncher Rat', 'Rogue Drone', 'Swamp Troll',
  'Thornback Boar', 'Iron Bandit', 'Sand Viper', 'Gloom Bat', 'Obsidian Warlord',
  'Shadow Wolf', 'Rock Golem', 'Frost Yeti', 'Magma Scorpion', 'Crystal Spider',
  'Storm Serpent', 'Hexed Knight', 'Molten Brute', 'Abyssal Kraken', 'The Hollow King',
  'Bone Reaper', 'Void Wraith', 'Blood Moon Stalker', 'Iron Colossus', 'Chaos Chimera',
  'Ruin Wyrm', 'Titan of the Wastes', 'Eclipse Dragon', 'Emberclaw Prime', 'Nyx, Devourer of Light'
];

function generateLevels() {
  const levels = [];
  for (let i = 1; i <= 50; i++) {
    const t = (i - 1) / 49;
    const isBoss = i % 10 === 0;
    const rawReward = (isBoss ? 1.4 : 1) * (15 + (1000 - 15) * Math.pow(t, 1.3));
    const reward = Math.min(1000, Math.round(rawReward));
    const enemyHealth = Math.round((isBoss ? 1.6 : 1) * (30 + 6000 * Math.pow(t, 1.8)));
    const enemyAttack = Math.round((isBoss ? 1.3 : 1) * (3 + 300 * Math.pow(t, 1.7)));
    const recommendedPower = Math.round(8 + 900 * Math.pow(t, 1.6));
    levels.push({ level: i, name: BEAST_NAMES[i - 1], isBoss, reward, enemyHealth, enemyAttack, recommendedPower });
  }
  return levels;
}

const LEVELS = generateLevels();

if (typeof module !== 'undefined') module.exports = { LEVELS };
