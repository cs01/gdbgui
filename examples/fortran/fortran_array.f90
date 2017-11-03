program array
  integer, parameter :: n=3
  integer :: ii
  real, dimension(n) :: a, b
  real, dimension(n,n) :: c

  a = [( real(ii), ii=1, n )]

  do ii = 1,n
    print *, a(ii)
  enddo

  b = 0.
  do ii = 1, n
    ! You could just write b = a ** 2., but I want to see the loop progress
    b(ii) = a(ii) ** 2.
  enddo

  do ii = 1, n
    print *, b(ii)
  enddo

  c = reshape( [( real(ii), ii=1,n**2 )], [n,n] )
  do ii = 1, n
    print *, c(ii,:)
  enddo

end program
