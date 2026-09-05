import headerNavLinks from '@/data/headerNavLinks'

test('exposes one Blog archive link between the existing Home and Work With Me links', () => {
  expect(headerNavLinks).toEqual([
    { href: '/', title: 'Home' },
    { href: '/blog', title: 'Blog' },
    { href: '/about', title: 'Work With Me' },
  ])
  expect(headerNavLinks.filter((link) => link.title === 'Blog')).toHaveLength(1)
})
