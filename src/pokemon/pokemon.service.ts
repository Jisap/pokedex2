import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';
import { Model, isValidObjectId } from 'mongoose';
import { Pokemon } from './entities/pokemon.entity';
import { InjectModel } from '@nestjs/mongoose';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PokemonService {

  private defaultLimit: number;

  constructor(
    @InjectModel(Pokemon.name)
    private readonly pokemonModel: Model<Pokemon>,
    private readonly configService: ConfigService
  ){
    this.defaultLimit = configService.get<number>('defaultLimit')
  }

  async create(createPokemonDto: CreatePokemonDto) {

    createPokemonDto.name = createPokemonDto.name.toLowerCase();           // El name del dto lo grabaremos en bd en minúsculas.
  
    try {
      const pokemon = await this.pokemonModel.create(createPokemonDto);    // Creamos el pokemon en la base de datos usando el modelo de mongoose
      return pokemon;                                                      // Retornamos el pokemon creado.
    } catch (error) {
      this.handleExceptions(error)
    }
  }

  findAll(paginationDto: PaginationDto) {
    const { limit = this.defaultLimit, offset = 0 } = paginationDto; // Obtenemos del dto de paginación el limit y offset

    return this.pokemonModel.find()               // Buscamos todos los pokemons con los limit y offset de paginación
      .limit(limit)
      .skip(offset)
      .sort({ no: 1 })                                                 // Ordenamos los pokemons por el no de forma ascendente
      .select('-__v')                                                  // Omitimos el campo __v de los pokemons
  }

  async findOne(term: string) {
    
    let pokemon: Pokemon; // isNaN () implica que no es un número, luego !isNaN() implica que si es un número válido

    if (!isNaN(+term)) {                                           // Si el term es un numero entero, (!isNaN(+term)) es true
      pokemon = await this.pokemonModel.findOne({ no: term });     // Buscamos el pokemon por el no=term
    }

    if (!pokemon && isValidObjectId(term)) {                     // Si no existe un pokemon y si el term es un id de mongo 
      pokemon = await this.pokemonModel.findById(term);          // Buscamos el pokemon por el id=term
    }

    if (!pokemon) {                                                                    // Si no buscamos por un id o por un no, entonces buscamos por el nombre
      pokemon = await this.pokemonModel.findOne({ name: term.toLocaleLowerCase() });   // Buscamos el pokemon por el name=term
    }

    if (!pokemon) throw new NotFoundException(`The pokemon with id, name or no = ${term} was not found`);

    return pokemon;
  }

  async update(term: string, updatePokemonDto: UpdatePokemonDto) {
    
    const pokemon = await this.findOne(term); // Utilizamos el método anteriormente creado (findOne) para buscar el pokemon por su id, name o no
    if (updatePokemonDto.name) {
      updatePokemonDto.name = updatePokemonDto.name.toLowerCase(); // Convertimos el nombre del dto a minúsculas
    }

    try {
      await pokemon.updateOne(updatePokemonDto, { new: true });     // Actualizamos el pokemon con el updatePokemonDto
      return { ...pokemon.toJSON(), ...updatePokemonDto };          // Retornamos el pokemon actualizado

    } catch (error) {
      this.handleExceptions(error)
    }
  }

  async remove(id: string) {
    // Opcion 1
    // const pokemon = await this.findOne( id );  // La eliminación se puede hacer por su id, name o no
    // await pokemon.deleteOne()                  // ya que utilizamos el método anteriormente creado (findOne)
    // Opcion 2
    //const result = await this.pokemonModel.findByIdAndDelete( id );    // Nosotros queremos que el id sea de mongo para poder borrar
    // Opcion 3
    const { deletedCount } = await this.pokemonModel.deleteOne({ _id: id });    // Borramos el registro que cumpla las condiciones del id
    if (deletedCount === 0) {                                                   // Si no se borro ningun registro, entonces el id no existe  
      throw new NotFoundException(`The pokemon with id = ${id} was not found`);
    }

    return { message: `The pokemon with id = ${id} was deleted` };
  }

  private handleExceptions(error: any) {
    if (error.code === 11000) {                                           // Si el error es de tipo 11000, entonces el pokemon ya existe
      throw new BadRequestException(`The pokemon already exists in db ${JSON.stringify(error.keyValue)}`);
    }
    console.log(error);                                                   // Si el error es de otro tipo, entonces mostramos el error   
    throw new InternalServerErrorException(`The pokemon could not be created - Check server logs`);
  }
}
