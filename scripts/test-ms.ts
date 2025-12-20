import ms from 'ms';

// Valid formats
console.log('Valid formats:');
console.log(`'15m' →`, ms('15m'));
console.log(`'1h' →`, ms('1h'));
console.log(`'7d' →`, ms('7d'));
console.log(`'500ms' →`, ms('500ms'));
console.log(`'5s' →`, ms('5s'));

// Invalid formats
console.log('\nInvalid formats:');
console.log(`'invalid' →`, ms('invalid' as ms.StringValue));
console.log(`'abc' →`, ms('abc' as ms.StringValue));
console.log(`'' →`, ms('' as ms.StringValue));
console.log(`'15' →`, ms('15' as ms.StringValue));
