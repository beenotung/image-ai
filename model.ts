import { existsSync, readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

let img_width = 32
let img_height = 32

type Data = number[] | Buffer

type ConvolveData = {
  channels: number
  width: number
  height: number
  data: Data
  getValue(c: number, x: number, y: number): number
  setValue(c: number, x: number, y: number, value: number): void
}

async function loadImageFromFile(file: string): Promise<ConvolveData> {
  let { info, data } = await sharp(file)
    .resize({
      width: img_width,
      height: img_height,
      fit: 'contain',
    })
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { channels, width, height } = info
  const width_height = width * height
  function getValue(c: number, x: number, y: number): number {
    let i = c * width_height + y * width + x
    return data[i]
  }
  function setValue(c: number, x: number, y: number, value: number) {
    let i = c * width_height + y * width + x
    data[i] = value
  }
  return {
    channels,
    width,
    height,
    data,
    getValue,
    setValue,
  }
}

const kernel_width = 3
const kernel_height = 3
const kernel_size = kernel_width * kernel_height

type Kernel = number[]

function applyConvolveKernel(
  output_channel: number,
  input: ConvolveData,
  kernel: Kernel,
  output: ConvolveData,
) {
  let { channels, width, height, getValue } = input
  let { setValue } = output

  for (let y = 0; y < height; y++) {
    let top = (y + 1) % height
    let bottom = (y - 1 + height) % height

    for (let x = 0; x < width; x++) {
      let right = (x + 1) % width
      let left = (x - 1 + width) % width

      let kernel_index = 0
      let acc = 0
      for (let c = 0; c < channels; c++) {
        acc +=
          /* top */
          getValue(c, left, top) * kernel[kernel_index] +
          getValue(c, x, top) * kernel[kernel_index + 1] +
          getValue(c, right, top) * kernel[kernel_index + 2] +
          /* middle */
          getValue(c, left, y) * kernel[kernel_index + 3] +
          getValue(c, x, y) * kernel[kernel_index + 4] +
          getValue(c, right, y) * kernel[kernel_index + 5] +
          /* bottom */
          getValue(c, left, bottom) * kernel[kernel_index + 6] +
          getValue(c, x, bottom) * kernel[kernel_index + 7] +
          getValue(c, right, bottom) * kernel[kernel_index + 8]
        kernel_index += 9
      }
      setValue(output_channel, x, y, acc)
    }
  }
}

type Model<Parameters extends ModelParameters> = {
  forward(input: ConvolveData): void
  output: Data
  toJSON(): Parameters
  fromJSON(parameters: Parameters): void
}

type ModelParameters = {
  [name: string]: Kernel[] | Linear
}

function readJSONFile(file: string) {
  let text = readFileSync(file).toString()
  return JSON.parse(text)
}

function writeJSONFile(file: string, data: object) {
  let text = JSON.stringify(data)
  return writeFileSync(file, text)
}

function checkModelParameters(model: Model<any>, file_parameters: any) {
  let model_parameters = model.toJSON()
  for (let key in model_parameters) {
    if (!(key in file_parameters)) {
      throw new Error('missing parameter: ' + key)
    }
    let model_parameter_type = type(model_parameters[key])
    let file_parameter_type = type(file_parameters[key])
    if (file_parameter_type != model_parameter_type) {
      throw new Error(
        `invalid parameter: expect ${model_parameter_type}, got: ${file_parameter_type}`,
      )
    }
  }
}

function type(data: any): string {
  if (Array.isArray(data)) {
    return type(data[0]) + '[]'
  }
  return typeof data
}

function saveModel(model: Model<any>, file: string) {
  let parameters = model.toJSON()
  writeJSONFile(file, parameters)
}

function loadModel(model: Model<any>, file: string) {
  let parameters = readJSONFile(file)
  checkModelParameters(model, parameters)
  model.fromJSON(parameters)
}

// reference: https://machinelearningmastery.com/building-a-convolutional-neural-network-in-pytorch/
// design in pytorch style
function randomModel() {
  let c_in = 3

  // convolve: input 3x32x32 -> output 32x32x32
  let c_out = 32
  let dim_out = 32
  let layer_1_convolve = randomConvolveLayer(c_in, c_out)
  let layer_1_output = allocateConvolveLayerOutput(c_out, dim_out)

  // convolve: input 32x32x32 -> output 32x32x32
  c_in = c_out
  c_out = 32
  let layer_2_convolve = randomConvolveLayer(c_in, c_out)
  let layer_2_output = allocateConvolveLayerOutput(c_out, dim_out)

  // maxPool: input 32x32x32 -> output 32x16x16
  c_in = c_out
  dim_out /= 2
  let layer_3_output = allocateConvolveLayerOutput(c_out, dim_out)

  // flatten: 8192
  c_out = c_out * dim_out * dim_out

  // linear: input 8192 -> output 512
  c_in = c_out
  c_out = 512
  let layer_4_linear = randomLinearLayer(c_in, c_out)
  let layer_4_output = allocateFlatLayerOutput(c_out)

  // linear: input 512 -> output 10
  c_in = c_out
  c_out = 10
  let layer_5_linear = randomLinearLayer(c_in, c_out)
  let layer_5_output = allocateFlatLayerOutput(c_out)

  function forward(input: ConvolveData) {
    applyConvolveLayer(layer_1_convolve, input, layer_1_output)
    applyReLu(layer_1_output.data)

    applyConvolveLayer(layer_2_convolve, layer_1_output, layer_2_output)
    applyReLu(layer_2_output.data)

    applyMaxPool(layer_2_output, layer_3_output)
    applyReLu(layer_3_output.data)

    applyLinearLayer(layer_4_linear, layer_3_output.data, layer_4_output)
    applyReLu(layer_4_output)

    applyLinearLayer(layer_5_linear, layer_4_output, layer_5_output)
  }

  type Parameters = ReturnType<typeof toJSON>

  function toJSON() {
    return {
      layer_1_convolve,
      layer_2_convolve,
      layer_4_linear,
      layer_5_linear,
    } satisfies ModelParameters
  }

  function fromJSON(parameters: Parameters) {
    layer_1_convolve = parameters.layer_1_convolve
    layer_2_convolve = parameters.layer_2_convolve
    layer_4_linear = parameters.layer_4_linear
    layer_5_linear = parameters.layer_5_linear
  }

  return {
    forward,
    toJSON,
    fromJSON,
    output: layer_4_output,
  } satisfies Model<{}>
}

function applyReLu(data: Data) {
  let n = data.length
  for (let i = 0; i < n; i++) {
    if (data[i] < 0) {
      data[i] = 0
    }
  }
}

function applyNormalization(data: Data) {
  let n = data.length
  let min = Math.min.apply(null, data as number[])
  let max = Math.max.apply(null, data as number[])
  let range = max - min
  for (let i = 0; i < n; i++) {
    data[i] = ((data[i] - min) / range) * 2 - 1
  }
}

function maxIndexAndValue(data: Data) {
  let max_index = 0
  let max_value = 0
  let n = data.length
  for (let i = 1; i < n; i++) {
    let value = data[i]
    if (value > max_value) {
      max_value = value
      max_index = i
    }
  }
  return {
    index: max_index,
    value: max_value,
  }
}

function applySoftMax(data: Data) {
  let n = data.length
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += data[i] = Math.exp(data[i])
  }
  for (let i = 0; i < n; i++) {
    data[i] = data[i] / sum
  }
}

function allocateConvolveLayerOutput(
  channels: number,
  dim: number,
): ConvolveData {
  const data = new Array<number>(channels * dim * dim)
  const width = dim
  const width_height = dim * dim
  function getValue(c: number, x: number, y: number): number {
    let i = c * width_height + y * width + x
    return data[i]
  }
  function setValue(c: number, x: number, y: number, value: number): void {
    let i = c * width_height + y * width + x
    data[i] = value
  }
  return {
    channels,
    width: dim,
    height: dim,
    data,
    getValue,
    setValue,
  }
}

function allocateFlatLayerOutput(n: number): Data {
  let data = new Array<number>(n)
  return data
}

function randomConvolveLayer(n_channel: number, n_kernel: number): Kernel[] {
  let kernels = new Array<Kernel>(n_kernel)
  for (let i = 0; i < n_kernel; i++) {
    kernels[i] = randomConvolveKernel(n_channel)
  }
  return kernels
}

type Linear = {
  weights: number[]
  bias: number
}

function randomLinearLayer(c_in: number, c_out: number): Linear {
  let n = c_in * c_out
  let weights = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    weights[i] = Math.random() * 2 - 1
  }
  let bias = Math.random() * 2 - 1
  return {
    weights,
    bias,
  }
}

function applyLinearLayer(layer: Linear, input: Data, output: Data) {
  let { weights, bias } = layer
  let index_size = input.length
  let output_size = output.length
  let weight_index = 0
  for (let output_index = 0; output_index < output_size; output_index++) {
    let acc = bias
    for (let input_index = 0; input_index < index_size; input_index++) {
      let input_value = input[input_index]
      let weight = weights[weight_index]
      acc += input_value * weight
      weight_index++
    }
    output[output_index] = acc
  }
}

function applyMaxPool(input: ConvolveData, output: ConvolveData) {
  let { channels, width, height, getValue } = input
  for (let c = 0; c < channels; c++) {
    for (let y = 0, output_y = 0; y < height; y += 2, output_y++) {
      for (let x = 0, output_x = 0; x < width; x += 2, output_x++) {
        let value = Math.max(
          getValue(c, x, y),
          getValue(c, x + 1, y),
          getValue(c, x, y + 1),
          getValue(c, x + 1, y + 1),
        )
        output.setValue(c, output_x, output_y, value)
      }
    }
  }
}

function applyConvolveLayer(
  kernels: Kernel[],
  input: ConvolveData,
  output: ConvolveData,
) {
  let n = kernels.length
  for (let c = 0; c < n; c++) {
    applyConvolveKernel(c, input, kernels[c], output)
  }
}

function randomConvolveKernel(n_channel: number): Kernel {
  let kernel: Kernel = new Array<number>(kernel_size)
  for (let i = 0; i < kernel_size * n_channel; i++) {
    kernel[i] = Math.random() * 2 - 1
  }
  return kernel
}

async function main() {
  let model = randomModel()

  let model_file = 'model.json'
  if (existsSync(model_file)) {
    loadModel(model, model_file)
  } else {
    saveModel(model, model_file)
  }

  let image_file = 'data/cifar-10/train/1445.png'
  let input = await loadImageFromFile(image_file)

  model.forward(input)

  let output = model.output
  console.log('output:', output)

  applyNormalization(output)
  console.log('normalized output:', output)

  applySoftMax(output)
  console.log('softmax output:', output)

  let candidate = maxIndexAndValue(output)
  console.log('candidate:', candidate)
}
main().catch(e => console.error(e))
