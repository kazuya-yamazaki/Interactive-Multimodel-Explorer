! Compile by: f2py -m lhpos -c --f90flags='-O2' lhpos.f90

subroutine calc_lhpos_global(nx,ny,np, slp, r, locs)
	implicit none
	integer, intent(in) :: nx,ny,np
	real(4), intent(in) :: slp(ny,nx)
	integer, intent(out) :: locs(2,np,2)
	integer, intent(in) :: r
	real(4), parameter :: pi = atan(1.0_4)*4
	integer :: rx, i, j, ii, jj, ip_high, ip_low, ip
	logical :: is_min, is_max
	real(4) :: val

	locs(:,:,:) = -1
	ip_high = 1
	ip_low = 1
	do j = 2, ny-1
	do i = 1, nx
		rx = min(nint(r/cos((j-(ny+1.0)/2)/ny*pi)), nx/2)
		val = slp(j,i)
		if(val <= resolve_cyclic(slp,ny,nx,j,i-1) .and. val <= resolve_cyclic(slp,ny,nx,j,i+1) &
			.and. val <= resolve_cyclic(slp,ny,nx,j-1,i) .and. val <= resolve_cyclic(slp,ny,nx,j+1,i)) then
			is_min = .true.
			do jj = 0, 5
				do ii = 0, 5
					if (val > resolve_cyclic(slp,ny,nx,j-r+jj*2*r/5,i-rx+ii*2*rx/5)) then
						is_min = .false.
						exit
					endif
				enddo
				if (.not. is_min) exit
			enddo
			if(is_min) then
				do jj = -r, r
					do ii = -rx, rx
						if (val > resolve_cyclic(slp,ny,nx,j+jj,i+ii)) then
							is_min = .false.
							exit
						endif
					enddo
					if (.not. is_min) exit
				enddo
				if ( is_min ) then
					do ip = 1, ip_low
						if(abs(i-1-locs(1,ip,1)) < rx .and. abs(j-1-locs(1,ip,2)) < r) then
							is_min = .false.
							exit
						endif
					enddo
					if ( is_min ) then
						if(ip_low <= np) then
							locs(1,ip_low,1) = i-1
							locs(1,ip_low,2) = j-1
							ip_low = ip_low + 1
						else
							write(*,*) "Too many lows"
						endif
					endif
				endif
			endif
		endif
		
		if(val >= resolve_cyclic(slp,ny,nx,j,i-1) .and. val >= resolve_cyclic(slp,ny,nx,j,i+1) .and. &
			val >= resolve_cyclic(slp,ny,nx,j-1,i) .and. val >= resolve_cyclic(slp,ny,nx,j+1,i)) then
			is_max = .true.
			do jj = 0, 5
				do ii = 0, 5
					if (val < resolve_cyclic(slp,ny,nx,j-r+jj*2*r/5,i-rx+ii*2*rx/5)) then
						is_max = .false.
						exit
					endif
				enddo
				if (.not. is_max) exit
			enddo
			if ( is_max ) then
				do jj = -r, r
					do ii = -rx, rx
						if (val < resolve_cyclic(slp,ny,nx,j+jj,i+ii)) then
							is_max = .false.
							exit
						endif
					enddo
					if (.not. is_max) exit
				enddo
				if ( is_max ) then
					do ip = 1, ip_high
						if(abs(i-1-locs(2,ip,1)) < rx .and. abs(j-1-locs(2,ip,2)) < r) then
							is_max = .false.
							exit
						endif
					enddo
					if ( is_max ) then
						if(ip_high <= np) then
							locs(2,ip_high,1) = i-1
							locs(2,ip_high,2) = j-1
							ip_high = ip_high + 1
						else
							write(*,*) "Too many highs"
						endif
					endif
				endif
			endif
		endif
	enddo
	enddo
	return
contains

real(4) function resolve_cyclic(ary, ny,nx, j,i)
	implicit none
	integer, intent(in) :: nx,ny,i,j
	real(4), intent(in) :: ary(ny,nx)
	integer :: ii, jj
	
	ii = mod(i-1+nx, nx) + 1
	jj = j
	
	if(jj < 1) then
		jj = 2 - jj
		ii = nx+1 - ii
	endif
	if(jj > ny) then
		jj = 2*ny - jj
		ii = nx+1 - ii
	endif
	
	resolve_cyclic = ary(jj, ii)
end function resolve_cyclic

end subroutine calc_lhpos_global

