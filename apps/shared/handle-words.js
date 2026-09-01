/**
 * Word lists for the random `adjective-noun` account handle (DEC-021, L1).
 *
 * Plain data, no dependency — committed the same way `fixtures/` is. Every
 * entry is lowercase `[a-z]+` with no hyphen, so `<adjective>-<noun>` always
 * matches the `^[a-z0-9-]+$` handle rule and is never pure-numeric. Kept a bit
 * over 120 words each: 120 x 120 = ~14k pairs, so a fresh account almost never
 * collides and the numeric-suffix fallback in `pocketbase.js` almost never
 * fires.
 *
 * Consumed by `apps/shared/handle.js` (`randomHandle()`).
 */

export const adjectives = [
  'able', 'active', 'agile', 'amber', 'ample', 'ancient', 'apt', 'arctic',
  'ardent', 'autumn', 'balmy', 'bold', 'brave', 'burnished', 'bright', 'brisk',
  'calm', 'candid', 'canny', 'chief', 'clear', 'clever', 'cobalt', 'cosmic',
  'crisp', 'daring', 'dawn', 'deep', 'deft', 'dry', 'eager', 'early', 'easy',
  'electric', 'even', 'fair', 'fabled', 'fast', 'fearless', 'fine', 'firm',
  'first', 'fleet', 'fond', 'free', 'fresh', 'gentle', 'giant', 'glad',
  'golden', 'grand', 'granite', 'grassy', 'happy', 'hardy', 'hazel', 'hearty',
  'high', 'humble', 'ideal', 'indigo', 'ivory', 'jolly', 'keen', 'kind',
  'level', 'light', 'lively', 'loyal', 'lucid', 'lucky', 'mellow', 'merry',
  'mighty', 'mild', 'misty', 'modest', 'noble', 'north', 'olive', 'open',
  'pale', 'patient', 'placid', 'plain', 'plucky', 'polar', 'prime', 'proud',
  'pure', 'quick', 'quiet', 'rapid', 'ready', 'regal', 'ripe', 'robust',
  'rugged', 'rustic', 'sage', 'sandy', 'scarlet', 'sharp', 'shy', 'silent',
  'silver', 'simple', 'sleek', 'slate', 'snug', 'solar', 'solid', 'sound',
  'spry', 'stark', 'steady', 'stern', 'still', 'stoic', 'stout', 'sturdy',
  'sunny', 'supple', 'swift', 'tan', 'teal', 'tidal', 'tidy', 'timber',
  'tireless', 'tranquil', 'trusty', 'upbeat', 'valiant', 'vast', 'vivid',
  'warm', 'wary', 'welcome', 'whole', 'wild', 'wily', 'winter', 'wise',
  'witty', 'woven', 'young', 'zesty',
];

export const nouns = [
  'acorn', 'alder', 'anchor', 'anvil', 'arbor', 'arch', 'arrow', 'ash',
  'aspen', 'badger', 'barley', 'basin', 'bay', 'beacon', 'bear', 'birch',
  'bison', 'blossom', 'bluff', 'bolt', 'boulder', 'brook', 'buck', 'cairn',
  'canyon', 'cedar', 'cinder', 'clay', 'cliff', 'clover', 'comet', 'compass',
  'coral', 'cove', 'crane', 'creek', 'crest', 'crow', 'dawn', 'delta', 'dune',
  'eagle', 'ember', 'fable', 'falcon', 'fell', 'fern', 'fjord', 'flint',
  'forge', 'fox', 'gale', 'garnet', 'geode', 'glade', 'glen', 'granite',
  'grove', 'gull', 'harbor', 'hawk', 'heath', 'hedge', 'heron', 'hollow',
  'ibex', 'inlet', 'iron', 'kestrel', 'lake', 'lantern', 'larch', 'ledge',
  'lynx', 'maple', 'marsh', 'meadow', 'mesa', 'moor', 'moss', 'moth',
  'mountain', 'oak', 'orbit', 'otter', 'owl', 'peak', 'pebble', 'pike',
  'pine', 'plateau', 'plume', 'quarry', 'quill', 'rapids', 'raven', 'reef',
  'ridge', 'river', 'robin', 'rowan', 'sable', 'sage', 'sandpiper', 'shale',
  'shore', 'slate', 'sparrow', 'spring', 'spruce', 'stag', 'stone', 'summit',
  'swift', 'talon', 'thicket', 'thorn', 'tide', 'timber', 'trail', 'tundra',
  'valley', 'vale', 'vireo', 'wave', 'willow', 'wolf', 'wren',
];
