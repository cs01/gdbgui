GDBGUI=../../gdbgui/backend.py

array_demo: fortran_array.f90
	gfortran fortran_array.f90 -o array_f90.a -g
	@echo Run with gdbgui: gdbgui --args array_f90.a
