program array
integer, parameter :: n=5
integer :: ii
real, dimension(n) :: a, b

a = [( real(ii), ii=1,N )]

do ii = 1,N
print *, a(ii)
enddo

b = 0.
do ii = 1,N
b(ii) = a(ii) ** 2.
enddo

do ii = 1,N
print *, b(ii)
enddo

end program
